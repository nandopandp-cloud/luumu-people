import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas na primeira leitura.
 * Nada aqui pode ser exposto ao cliente (nenhuma variável NEXT_PUBLIC_*).
 * Documentação de cada variável: docs/environment.md e .env.example.
 */
const databaseUrl = z
  .string()
  .min(1)
  .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://") || v.startsWith("pglite://"), {
    message: "Use postgres://, postgresql:// ou pglite://",
  });

/**
 * URL pública. Na Vercel, se APP_URL não for definida, usa as variáveis de
 * sistema: domínio de produção em Production; URL da branch/deploy em Preview.
 */
function defaultAppUrl(): string {
  const e = process.env;
  if (e.VERCEL_ENV === "production" && e.VERCEL_PROJECT_PRODUCTION_URL) return `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (e.VERCEL_BRANCH_URL) return `https://${e.VERCEL_BRANCH_URL}`;
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Origens aceitas para login/CSRF: a URL pública e, na Vercel, os demais endereços do mesmo deploy. */
export function trustedOrigins(): string[] {
  const e = process.env;
  const hosts = [e.VERCEL_URL, e.VERCEL_BRANCH_URL, e.VERCEL_ENV === "production" ? e.VERCEL_PROJECT_PRODUCTION_URL : undefined];
  return [...new Set([env().APP_URL, ...hosts.filter(Boolean).map((h) => `https://${h}`)])];
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default(defaultAppUrl),
  DATABASE_URL: databaseUrl.default("pglite://.data/pglite"),
  DATABASE_URL_AUTH: databaseUrl.optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET precisa de pelo menos 32 caracteres"),
  SESSION_IDLE_HOURS: z.coerce.number().int().min(1).max(24).default(8),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  EMAIL_FROM: z.string().default("Luumu People <nao-responda@luumu.app>"),
  RESEND_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.DATABASE_URL.startsWith("pglite://")) {
    throw new Error("PGlite não é permitido em produção. Configure DATABASE_URL com o Neon.");
  }
  cached = parsed.data;
  return cached;
}

/** Apenas para testes: força releitura de process.env. */
export function resetEnvCache() {
  cached = undefined;
}
