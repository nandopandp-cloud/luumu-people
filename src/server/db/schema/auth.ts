import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, timestamps, updatedAt } from "./_columns";
import { organizations } from "./tenancy";

/**
 * Tabelas de identidade e autenticação. Os nomes das propriedades seguem o
 * contrato do Better Auth (emailVerified, userId…), as colunas seguem snake_case.
 *
 * `users` é a identidade de login. Dados de RH ficam em `employee_profiles`
 * (ver organization.ts) — separação entre identidade e dados pessoais.
 */

export const USER_STATUSES = ["invited", "active", "inactive"] as const;

export const users = pgTable(
  "users",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** Capa do perfil (URL interna /api/v1/files/:id) — escolhida pela própria pessoa. */
    profileCover: text("profile_cover"),
    /** @deprecated 2FA foi descartado do produto. Remover na próxima release (expand/contract). */
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    status: text("status", { enum: USER_STATUSES }).notNull().default("invited"),
    ...timestamps(),
  },
  (t) => [
    unique("users_tenant_id_id_key").on(t.tenantId, t.id),
    index("users_tenant_id_status_idx").on(t.tenantId, t.status),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps(),
  },
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    unique("accounts_provider_account_key").on(t.providerId, t.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    ...timestamps(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/**
 * @deprecated 2FA foi descartado do produto. Tabela mantida só até a próxima
 * release, para não quebrar a versão anterior durante o deploy (expand/contract).
 */
export const twoFactors = pgTable(
  "two_factors",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("two_factors_user_id_idx").on(t.userId), index("two_factors_secret_idx").on(t.secret)],
);

/** Armazenamento do rate limit do Better Auth (serverless: memória não é compartilhada). */
export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * Bloqueio por conta (complementa o rate limit por IP).
 * A chave é o HMAC do e-mail normalizado — o e-mail não fica armazenado aqui.
 */
export const loginThrottles = pgTable("login_throttles", {
  key: text("key").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  windowStartedAt: createdAt(),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
  updatedAt: updatedAt(),
});
