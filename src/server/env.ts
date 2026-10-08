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

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
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
