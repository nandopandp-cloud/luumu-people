import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getAuth } from "@/server/auth/auth";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { headersWith } from "../support/auth";
import { testDatabase, userOf } from "../support/db";

const ORIGIN = "http://localhost:3000";

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** id_token como o Google devolve no endpoint de token (a assinatura não é checada no fluxo de código). */
function idToken(claims: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, iat: now, exp: now + 3600, ...claims };
  return `${base64url({ alg: "RS256", typ: "JWT" })}.${base64url(payload)}.assinatura`;
}

/** Simula o endpoint de token do Google; as demais requisições seguem para o fetch real. */
function stubGoogleToken(claims: Record<string, unknown>) {
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "ya29.teste", token_type: "Bearer", expires_in: 3600, scope: "openid email profile", id_token: idToken(claims) });
    }
    return realFetch(input, init);
  });
}

function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

/** Fluxo completo: /sign-in/social → (Google) → /callback/google. Devolve a resposta do callback. */
async function signInWithGoogle(claims: Record<string, unknown>) {
  const auth = await getAuth();
  const start = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ provider: "google", callbackURL: "/inicio", errorCallbackURL: "/entrar" }),
    }),
  );
  expect(start.status).toBe(200);
  const { url } = (await start.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  stubGoogleToken(claims);
  const callback = await auth.handler(
    new Request(`${ORIGIN}/api/auth/callback/google?code=codigo-teste&state=${state}`, {
      headers: { cookie: cookiesFrom(start) },
    }),
  );
  return callback;
}

describe("login com Google", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("o início do login aponta para o Google com escolha de conta e PKCE", async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ provider: "google", callbackURL: "/inicio" }),
      }),
    );
    const { url } = (await response.json()) as { url: string };
    const target = new URL(url);
    expect(target.host).toBe("accounts.google.com");
    expect(target.searchParams.get("prompt")).toBe("select_account");
    expect(target.searchParams.get("code_challenge_method")).toBe("S256");
    expect(target.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/google`);
  });

  it("recusa callbackURL externo (open redirect)", async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ provider: "google", callbackURL: "https://malicioso.example/roubo" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("pessoa cadastrada entra com o Google: vincula a conta, cria sessão e audita", async () => {
    const { db } = await testDatabase();
    const user = await userOf("aurora", "bruno");
    const response = await signInWithGoogle({ sub: "google-bruno", email: user.email, email_verified: true, name: "Outro Nome", picture: "https://exemplo/foto.png" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/inicio");
    const actor = await resolveActor(headersWith(cookiesFrom(response)));
    expect(actor?.userId).toBe(user.id);
    // Nome segue o cadastro da empresa, não o perfil do Google.
    expect(actor?.user.name).not.toBe("Outro Nome");

    const [account] = await db.select().from(s.accounts).where(and(eq(s.accounts.userId, user.id), eq(s.accounts.providerId, "google")));
    expect(account?.accountId).toBe("google-bruno");
    expect(account?.accessToken).not.toBe("ya29.teste"); // tokens criptografados

    const audit = await db.select({ action: s.auditLogs.action, metadata: s.auditLogs.metadata }).from(s.auditLogs).where(eq(s.auditLogs.actorUserId, user.id));
    expect(audit.map((r) => r.action)).toEqual(expect.arrayContaining(["auth.sso_linked", "auth.login"]));
    expect(audit.find((r) => r.action === "auth.login")?.metadata).toMatchObject({ method: "google" });
  });

  it("no segundo acesso reaproveita o vínculo existente", async () => {
    const user = await userOf("aurora", "isabela");
    await signInWithGoogle({ sub: "google-isabela", email: user.email, email_verified: true });
    vi.restoreAllMocks();
    const again = await signInWithGoogle({ sub: "google-isabela", email: user.email, email_verified: true });
    expect(again.headers.get("location")).toBe("/inicio");
    expect((await resolveActor(headersWith(cookiesFrom(again))))?.userId).toBe(user.id);
  });

  it("e-mail sem cadastro não cria usuário (sem cadastro público)", async () => {
    const { db } = await testDatabase();
    const response = await signInWithGoogle({ sub: "google-intruso", email: "intruso@gmail.com", email_verified: true });
    expect(response.headers.get("location")).toMatch(/^\/entrar\?error=signup_disabled/);
    expect(await db.select().from(s.users).where(eq(s.users.email, "intruso@gmail.com"))).toHaveLength(0);
  });

  it("e-mail não verificado pelo Google não é vinculado", async () => {
    const { db } = await testDatabase();
    const user = await userOf("aurora", "diego");
    const response = await signInWithGoogle({ sub: "google-diego", email: user.email, email_verified: false });
    expect(response.headers.get("location")).toMatch(/^\/entrar\?error=account_not_linked/);
    expect(await db.select().from(s.accounts).where(and(eq(s.accounts.userId, user.id), eq(s.accounts.providerId, "google")))).toHaveLength(0);
  });

  it("pessoa inativa não entra com o Google", async () => {
    const { db } = await testDatabase();
    const user = await userOf("aurora", "leticia");
    await db.update(s.users).set({ status: "inactive" }).where(eq(s.users.id, user.id));
    const response = await signInWithGoogle({ sub: "google-leticia", email: user.email, email_verified: true });
    expect(response.headers.get("location")).toMatch(/^\/entrar\?error=/);
    expect(cookiesFrom(response)).not.toMatch(/luumu\.session_token=[^;]+/);
  });
});
