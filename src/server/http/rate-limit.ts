import "server-only";
import { sql } from "drizzle-orm";
import type { TenantContext, Tx } from "@/server/db/tenant";
import { withTenant } from "@/server/db/tenant";

/**
 * Rate limit de janela fixa da API, compartilhado entre TODAS as instâncias
 * (contador no Postgres, função atômica app.rate_limit_hit). Os endpoints de
 * autenticação usam o limitador próprio do Better Auth (tabela rate_limits).
 *
 * O store é plugável para testes ou para um backend dedicado no futuro.
 */
export interface RateLimitStore {
  hit(ctx: TenantContext, key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Opcional: a mesma contagem dentro de uma transação de tenant já aberta (poupa uma transação por requisição). */
  hitIn?(tx: Tx, key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

async function hitInTransaction(tx: Tx, key: string, windowMs: number) {
  const result = await tx.execute(sql`select hits, reset_at from app.rate_limit_hit(${key}, ${windowMs})`);
  const row = (result as unknown as { rows: { hits: number; reset_at: Date | string }[] }).rows[0]!;
  return { count: Number(row.hits), resetAt: new Date(row.reset_at).getTime() };
}

export const postgresStore: RateLimitStore = {
  hit: (ctx, key, windowMs) => withTenant(ctx, (tx: Tx) => hitInTransaction(tx, key, windowMs)),
  hitIn: hitInTransaction,
};

/** Store em memória (por processo): testes unitários e o limite volátil abaixo. */
export function memoryStore(now: () => number = Date.now): RateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(_ctx, key, windowMs) {
      const t = now();
      const current = buckets.get(key);
      if (!current || current.resetAt <= t) {
        const fresh = { count: 1, resetAt: t + windowMs };
        buckets.set(key, fresh);
        return fresh;
      }
      current.count += 1;
      return current;
    },
  };
}

export type RateLimitRule = { limit: number; windowMs: number };

export const DEFAULT_RATE_LIMIT: RateLimitRule = { limit: 120, windowMs: 60_000 };
export const SENSITIVE_RATE_LIMIT: RateLimitRule = { limit: 20, windowMs: 60_000 };
/**
 * Atualização periódica do chat (mensagens, lista, lido, digitando, presença):
 * contador próprio (a chave inclui o limite), para que janelas de conversa
 * abertas não consumam a cota do restante da plataforma.
 */
export const CHAT_SYNC_RATE_LIMIT: RateLimitRule = { limit: 300, windowMs: 60_000 };

let store: RateLimitStore = postgresStore;

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

/** O store atual consegue contar dentro de uma transação já aberta? (o de produção, no Postgres, sim) */
export const rateLimitCanRunInTransaction = () => store.hitIn !== undefined;

/** Conta o acesso numa transação de tenant já aberta. Só chamar se `rateLimitCanRunInTransaction()`. */
export async function checkRateLimitIn(tx: Tx, key: string, rule: RateLimitRule, now = Date.now()) {
  const bucket = await store.hitIn!(tx, key, rule.windowMs);
  return { allowed: bucket.count <= rule.limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

export async function checkRateLimit(
  ctx: TenantContext,
  key: string,
  rule: RateLimitRule,
  now = Date.now(),
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const bucket = await store.hit(ctx, key, rule.windowMs);
  return { allowed: bucket.count <= rule.limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}

const volatile = memoryStore();

/**
 * Limite em memória do processo (melhor esforço por instância). Usado só onde
 * nada ligado ao envio pode ser persistido: resposta de pesquisa anônima.
 */
export async function checkVolatileRateLimit(ctx: TenantContext, key: string, rule: RateLimitRule, now = Date.now()) {
  const bucket = await volatile.hit(ctx, key, rule.windowMs);
  return { allowed: bucket.count <= rule.limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}
