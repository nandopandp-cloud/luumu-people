import "server-only";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { authDb } from "@/server/db/client";
import { loginThrottles } from "@/server/db/schema";
import { env } from "@/server/env";

/**
 * Bloqueio por conta (complementa o rate limit por IP do Better Auth):
 * após MAX_FAILURES falhas dentro de WINDOW, a conta fica bloqueada por LOCK.
 * A chave é um HMAC do e-mail: o e-mail não é armazenado em claro.
 */
export const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export function throttleKey(email: string): string {
  return createHmac("sha256", env().BETTER_AUTH_SECRET).update(`login:${email.trim().toLowerCase()}`).digest("hex");
}

export async function isLocked(email: string, now = new Date()): Promise<boolean> {
  const db = await authDb();
  const [row] = await db.select({ lockedUntil: loginThrottles.lockedUntil }).from(loginThrottles).where(eq(loginThrottles.key, throttleKey(email)));
  return Boolean(row?.lockedUntil && row.lockedUntil > now);
}

/** Registra uma falha. Retorna true se a conta acabou de ser bloqueada. */
export async function registerFailure(email: string, now = new Date()): Promise<boolean> {
  const db = await authDb();
  const key = throttleKey(email);
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const [row] = await db
    .insert(loginThrottles)
    .values({ key, failedCount: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: loginThrottles.key,
      set: {
        failedCount: sql`case when ${loginThrottles.windowStartedAt} < ${windowStart} then 1 else ${loginThrottles.failedCount} + 1 end`,
        windowStartedAt: sql`case when ${loginThrottles.windowStartedAt} < ${windowStart} then ${now} else ${loginThrottles.windowStartedAt} end`,
        updatedAt: now,
      },
    })
    .returning({ failedCount: loginThrottles.failedCount });

  if (row && row.failedCount >= MAX_FAILURES) {
    await db
      .update(loginThrottles)
      .set({ lockedUntil: new Date(now.getTime() + LOCK_MS), failedCount: 0, windowStartedAt: now })
      .where(eq(loginThrottles.key, key));
    return true;
  }
  return false;
}

export async function clearFailures(email: string): Promise<void> {
  const db = await authDb();
  await db.delete(loginThrottles).where(eq(loginThrottles.key, throttleKey(email)));
}
