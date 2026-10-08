import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getAuth } from "@/server/auth/auth";
import { MAX_FAILURES } from "@/server/auth/login-throttle";
import { resolveActor } from "@/server/auth/session";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { headersWith, signIn } from "../support/auth";
import { testDatabase, userOf } from "../support/db";

describe("autenticação", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("login cria sessão com cookie HttpOnly e o ator carrega tenant e papéis", async () => {
    const { cookie, userId, tenantId } = await signIn("aurora", "fernando");
    expect(cookie).toMatch(/luumu\.session_token=/);

    const actor = await resolveActor(headersWith(cookie));
    expect(actor?.userId).toBe(userId);
    expect(actor?.tenantId).toBe(tenantId);
    expect(actor?.grants.map((g) => g.roleKey)).toEqual(["employee"]);
    expect(hasPermissionAnywhere(actor!, "management.access")).toBe(false);
  });

  it("o cookie de sessão é HttpOnly e SameSite=Lax", async () => {
    const user = await userOf("aurora", "camila");
    const auth = await getAuth();
    const response = await auth.api.signInEmail({ body: { email: user.email, password: "Teste@Seguro2026" }, asResponse: true });
    const sessionCookie = response.headers.getSetCookie().find((c) => c.startsWith("luumu.session_token="));
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
  });

  it("a senha é armazenada com Argon2id, nunca em texto puro", async () => {
    const { db } = await testDatabase();
    const user = await userOf("aurora", "fernando");
    const [account] = await db.select({ password: s.accounts.password }).from(s.accounts).where(eq(s.accounts.userId, user.id));
    expect(account?.password).toMatch(/^\$argon2id\$/);
  });

  it("senha errada não autentica e a mensagem não revela se o e-mail existe", async () => {
    const auth = await getAuth();
    const user = await userOf("aurora", "gabriel");
    const wrong = await auth.api.signInEmail({ body: { email: user.email, password: "senha-errada-123" }, asResponse: true });
    const unknown = await auth.api.signInEmail({ body: { email: "ninguem@aurora.example", password: "senha-errada-123" }, asResponse: true });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).message).toBe((await unknown.json()).message);
  });

  it(`bloqueia a conta após ${MAX_FAILURES} falhas, mesmo com a senha correta depois`, async () => {
    const auth = await getAuth();
    const user = await userOf("aurora", "helena");
    for (let i = 0; i < MAX_FAILURES; i++) {
      await auth.api.signInEmail({ body: { email: user.email, password: `errada-${i}-xxxxx` }, asResponse: true });
    }
    // Requisição HTTP real (como o navegador): o bloqueio vira 429.
    const blocked = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: user.email, password: "Teste@Seguro2026" }),
      }),
    );
    expect(blocked.status).toBe(429);
  });

  it("usuário inativo não consegue entrar", async () => {
    const { db } = await testDatabase();
    const user = await userOf("aurora", "caio");
    await db.update(s.users).set({ status: "inactive" }).where(eq(s.users.id, user.id));
    const auth = await getAuth();
    const response = await auth.api.signInEmail({ body: { email: user.email, password: "Teste@Seguro2026" }, asResponse: true });
    expect(response.status).not.toBe(200);
  });

  it("sessão de usuário desativado deixa de valer imediatamente", async () => {
    const { db } = await testDatabase();
    const { cookie, userId } = await signIn("aurora", "otavio");
    expect(await resolveActor(headersWith(cookie))).not.toBeNull();
    await db.update(s.users).set({ status: "inactive" }).where(eq(s.users.id, userId));
    expect(await resolveActor(headersWith(cookie))).toBeNull();
  });

  it("cadastro público está desabilitado", async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "intruso@exemplo.com", password: "SenhaForte@123", name: "Intruso" }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("login e logout ficam registrados na auditoria (sem dados sensíveis)", async () => {
    const { db } = await testDatabase();
    const { cookie, userId } = await signIn("aurora", "simone");
    const auth = await getAuth();
    await auth.api.signOut({ headers: headersWith(cookie) });

    const rows = await db
      .select({ action: s.auditLogs.action, metadata: s.auditLogs.metadata })
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.actorUserId, userId)));
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("auth.login");
    expect(actions).toContain("auth.logout");
    expect(JSON.stringify(rows)).not.toMatch(/Teste@Seguro2026|session_token/);
  });

  it("troca de senha exige a senha atual, vale no próximo login e fica na auditoria", async () => {
    const { db } = await testDatabase();
    const { cookie, userId } = await signIn("aurora", "luiza");
    const auth = await getAuth();
    await expect(
      auth.api.changePassword({ headers: headersWith(cookie), body: { currentPassword: "errada-errada", newPassword: "NovaSenha@Forte2026" } }),
    ).rejects.toThrow();
    await auth.api.changePassword({ headers: headersWith(cookie), body: { currentPassword: "Teste@Seguro2026", newPassword: "NovaSenha@Forte2026", revokeOtherSessions: true } });
    await expect(signIn("aurora", "luiza")).rejects.toThrow();
    await expect(signIn("aurora", "luiza", "NovaSenha@Forte2026")).resolves.toMatchObject({ userId });
    const rows = await db.select({ action: s.auditLogs.action }).from(s.auditLogs).where(eq(s.auditLogs.actorUserId, userId));
    expect(rows.map((r) => r.action)).toContain("auth.password_changed");
  });
});

