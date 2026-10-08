import "server-only";

/**
 * Rate limit de janela fixa para a API de negócio.
 *
 * Implementação em memória (por instância). Na Vercel cada instância tem seu
 * próprio contador — é uma barreira de melhor esforço contra abuso por um
 * usuário autenticado. Os endpoints de autenticação usam o limitador
 * persistente do Better Auth (tabela rate_limits). Para limites globais,
 * plugue um store distribuído implementando RateLimitStore (docs/security.md).
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, now: number): { count: number; resetAt: number };
}

class MemoryStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  hit(key: string, windowMs: number, now: number) {
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      if (this.buckets.size > 50_000) this.sweep(now);
      return fresh;
    }
    current.count += 1;
    return current;
  }

  private sweep(now: number) {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}

export type RateLimitRule = { limit: number; windowMs: number };

export const DEFAULT_RATE_LIMIT: RateLimitRule = { limit: 120, windowMs: 60_000 };
export const SENSITIVE_RATE_LIMIT: RateLimitRule = { limit: 20, windowMs: 60_000 };

let store: RateLimitStore = new MemoryStore();

export function setRateLimitStore(next: RateLimitStore) {
  store = next;
}

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const bucket = store.hit(key, rule.windowMs, now);
  return { allowed: bucket.count <= rule.limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
}
