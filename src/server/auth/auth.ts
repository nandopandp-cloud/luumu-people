import "server-only";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import { recordAudit, type AuditAction } from "@/server/audit/audit";
import { authDb } from "@/server/db/client";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { escapeHtml, sendEmail } from "@/server/email/mailer";
import { env, trustedOrigins } from "@/server/env";
import { logger } from "@/server/observability/logger";
import { clearFailures, isLocked, registerFailure } from "./login-throttle";
import { hashPassword, verifyPassword } from "./password";

/**
 * Autenticação (Better Auth) — sessões opacas em banco, cookies HttpOnly,
 * Argon2id, rate limit persistente, bloqueio por conta e trilha
 * de auditoria. Cadastro público desabilitado: contas são criadas pela empresa.
 *
 * Conecta-se com a role luumu_auth, que só enxerga tabelas de autenticação.
 */

async function tenantOfUser(userId: string): Promise<{ tenantId: string; status: string } | null> {
  const db = await authDb();
  const [row] = await db.select({ tenantId: s.users.tenantId, status: s.users.status }).from(s.users).where(eq(s.users.id, userId));
  return row ?? null;
}

async function audit(userId: string, action: AuditAction, meta: { ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> } = {}) {
  try {
    const owner = await tenantOfUser(userId);
    if (!owner) return;
    await withTenant({ tenantId: owner.tenantId, userId }, (tx) =>
      recordAudit(tx, {
        tenantId: owner.tenantId,
        actorUserId: userId,
        action,
        resourceType: "user",
        resourceId: userId,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        metadata: meta.metadata,
      }),
    );
  } catch (error) {
    // Falha de auditoria não pode derrubar o login, mas precisa ser visível.
    logger().error({ err: error, action }, "falha ao registrar auditoria de autenticação");
  }
}

/** Login só é permitido para usuários ativos de empresas ativas. */
async function assertCanSignIn(userId: string): Promise<boolean> {
  const owner = await tenantOfUser(userId);
  if (!owner || owner.status !== "active") return false;
  const [org] = await withTenant({ tenantId: owner.tenantId, userId }, (tx) =>
    tx.select({ status: s.organizations.status }).from(s.organizations),
  );
  return org?.status === "active";
}

function emailFrom(body: unknown): string | null {
  if (body && typeof body === "object" && "email" in body && typeof body.email === "string") return body.email;
  return null;
}

/**
 * Login com Google. Só entra quem a empresa já cadastrou: nunca cria usuário
 * (disableSignUp). No primeiro acesso, a conta Google é vinculada ao usuário
 * de mesmo e-mail, desde que o Google confirme o e-mail (email_verified) —
 * o Google NÃO está em trustedProviders, então e-mail não verificado é recusado.
 */
function socialProviders(config: ReturnType<typeof env>): BetterAuthOptions["socialProviders"] {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) return {};
  return {
    google: {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      hd: config.GOOGLE_HOSTED_DOMAIN,
      prompt: "select_account",
      disableSignUp: true,
      disableImplicitSignUp: true,
      // Nome e foto seguem o cadastro da empresa, não o perfil do Google.
      overrideUserInfoOnSignIn: false,
    },
  };
}

function buildOptions(database: BetterAuthOptions["database"]): BetterAuthOptions {
  const config = env();
  const production = config.NODE_ENV === "production";

  return {
    appName: "Luumu People",
    baseURL: config.APP_URL,
    basePath: "/api/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(),
    telemetry: { enabled: false },
    database,
    user: {
      modelName: "users",
      additionalFields: {
        tenantId: { type: "string", required: true, input: false },
        status: { type: "string", required: true, input: false },
      },
      changeEmail: { enabled: false },
      deleteUser: { enabled: false },
    },
    session: {
      modelName: "sessions",
      // Expiração por ociosidade (deslizante). O limite absoluto é aplicado em getActor().
      expiresIn: config.SESSION_IDLE_HOURS * 60 * 60,
      updateAge: 15 * 60,
      // Sem cache em cookie: revogações (desativação, troca de papel) valem na hora.
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "accounts",
      encryptOAuthTokens: true,
      // Vínculo implícito só para o login com Google (únicos provedores configurados);
      // contas são criadas pela empresa, então o e-mail local não passa por verificação.
      accountLinking: { enabled: true, requireLocalEmailVerified: false, allowDifferentEmails: false, updateUserInfoOnLink: false },
    },
    verification: {
      modelName: "verifications",
      storeIdentifier: "hashed",
    },
    socialProviders: socialProviders(config),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      async sendResetPassword({ user, url }) {
        const name = escapeHtml(user.name.split(" ")[0] ?? "");
        await sendEmail({
          to: user.email,
          subject: "Redefinição de senha — Luumu People",
          text: `Olá, ${user.name.split(" ")[0]}!\n\nRecebemos um pedido para redefinir sua senha. O link vale por 30 minutos:\n${url}\n\nSe não foi você, ignore este e-mail — sua senha continua a mesma.`,
          html: `<p>Olá, ${name}!</p><p>Recebemos um pedido para redefinir sua senha. O link vale por 30 minutos:</p><p><a href="${escapeHtml(url)}">Redefinir minha senha</a></p><p>Se não foi você, ignore este e-mail — sua senha continua a mesma.</p>`,
        });
        await audit(user.id, "auth.password_reset_requested");
      },
      async onPasswordReset({ user }) {
        await audit(user.id, "auth.password_reset");
      },
    },
    rateLimit: {
      enabled: config.NODE_ENV !== "test",
      storage: "database",
      modelName: "rateLimits",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: config.AUTH_SIGNIN_RATE_LIMIT },
        "/sign-in/social": { window: 60, max: config.AUTH_SIGNIN_RATE_LIMIT },
        "/request-password-reset": { window: 300, max: 3 },
        "/reset-password": { window: 300, max: 5 },
      },
    },
    advanced: {
      cookiePrefix: "luumu",
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: production, path: "/" },
      database: { generateId: "uuid" },
      // Explícito: o Better Auth desliga a checagem de origem/callbackURL quando
      // NODE_ENV=test; assim os testes validam o mesmo comportamento da produção.
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    },
    // Endpoints que a plataforma não oferece: cadastro aberto, alteração de
    // perfil/e-mail pelo Better Auth (perfil segue a política da empresa), exclusão.
    disabledPaths: ["/sign-up/email", "/update-user", "/change-email", "/delete-user", "/link-social", "/unlink-account"],
    logger: {
      disabled: config.NODE_ENV === "test",
      level: "warn",
      log: (level, message) => logger()[level]({ source: "better-auth" }, message),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const email = emailFrom(ctx.body);
        if (email && (await isLocked(email))) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
          });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/change-password") {
          const userId = ctx.context.session?.user.id;
          if (userId && !(ctx.context.returned instanceof APIError)) await audit(userId, "auth.password_changed");
          return;
        }
        if (ctx.path !== "/sign-in/email") return;
        const email = emailFrom(ctx.body);
        if (!email) return;
        const returned = ctx.context.returned;
        if (returned instanceof APIError) {
          if (returned.statusCode === 401 || returned.statusCode === 403) {
            const locked = await registerFailure(email);
            if (locked) logger().warn({ event: "auth.account_locked" }, "conta bloqueada temporariamente por tentativas");
          }
          return;
        }
        await clearFailures(email);
      }),
    },
    databaseHooks: {
      account: {
        create: {
          async after(account) {
            if (account.providerId !== "credential") await audit(account.userId, "auth.sso_linked", { metadata: { provider: account.providerId } });
          },
        },
      },
      session: {
        create: {
          async before(session) {
            if (!(await assertCanSignIn(session.userId))) return false;
          },
          async after(session, context) {
            const method = context?.path?.startsWith("/callback/") ? context.params?.id : "password";
            await audit(session.userId, "auth.login", { ip: session.ipAddress, userAgent: session.userAgent, metadata: method ? { method } : undefined });
          },
        },
        delete: {
          async after(session, context) {
            await audit(session.userId, context?.path === "/sign-out" ? "auth.logout" : "auth.session_revoked");
          },
        },
      },
    },
  };
}

async function createAuth() {
  const db = await authDb();
  return betterAuth(
    buildOptions(
      drizzleAdapter(db, {
        provider: "pg",
        schema: {
          users: s.users,
          sessions: s.sessions,
          accounts: s.accounts,
          verifications: s.verifications,
          rateLimits: s.rateLimits,
        },
      }),
    ),
  );
}

export type Auth = Awaited<ReturnType<typeof createAuth>>;

const globalKey = Symbol.for("luumu.auth");
type GlobalWithAuth = typeof globalThis & { [globalKey]?: Promise<Auth> };

export function getAuth(): Promise<Auth> {
  const g = globalThis as GlobalWithAuth;
  g[globalKey] ??= createAuth().catch((error) => {
    delete g[globalKey];
    throw error;
  });
  return g[globalKey];
}
