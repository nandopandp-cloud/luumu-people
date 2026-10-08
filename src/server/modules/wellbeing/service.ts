import "server-only";
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import type { MoodInput } from "./schemas";

/**
 * Check-in de humor — identificado, mas estritamente pessoal: a RLS só permite
 * ler/gravar o próprio registro (policy own_rows_only). Não é auditado por
 * conteúdo (dado sensível) e nunca é exposto individualmente a gestores.
 */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function getTodayMood(actor: AuthenticatedActor): Promise<number | null> {
  return withTenant(actor, async (tx) => {
    const [row] = await tx.select({ mood: s.moodCheckins.mood, date: s.moodCheckins.checkinDate }).from(s.moodCheckins).where(and(eq(s.moodCheckins.userId, actor.userId), eq(s.moodCheckins.checkinDate, todayInBrazil())));
    return row?.mood ?? null;
  });
}

export async function setTodayMood(actor: AuthenticatedActor, input: MoodInput): Promise<number> {
  return withTenant(actor, async (tx) => {
    await tx
      .insert(s.moodCheckins)
      .values({ tenantId: actor.tenantId, userId: actor.userId, checkinDate: todayInBrazil(), mood: input.mood })
      .onConflictDoUpdate({ target: [s.moodCheckins.userId, s.moodCheckins.checkinDate], set: { mood: input.mood, updatedAt: new Date() } });
    return input.mood;
  });
}
