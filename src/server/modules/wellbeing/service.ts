import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { todayInBrazil, type MoodValue } from "@/lib/moods";
import type { MoodInput } from "./schemas";

/**
 * Sentimento do dia — identificado e, por decisão de produto, visível para
 * todas as pessoas da empresa durante o dia (com o comentário). Gravar e mudar,
 * só o próprio (policies RESTRICTIVE de insert/update). O "dia" é o de Brasília.
 * Fechar o modal sem responder fica registrado à parte (só a pessoa vê) para o
 * modal não reabrir sozinho no mesmo dia, em nenhum dispositivo.
 */
export { todayInBrazil };

export type PersonMood = { mood: MoodValue; note: string | null; at: Date };
export type TodayMood = { mood: MoodValue | null; note: string | null; at: Date | null; dismissed: boolean };

const moodColumns = { userId: s.moodCheckins.userId, mood: s.moodCheckins.mood, note: s.moodCheckins.note, at: s.moodCheckins.updatedAt };

export async function getTodayMood(actor: AuthenticatedActor): Promise<TodayMood> {
  const day = todayInBrazil();
  return withTenant(actor, async (tx) => {
    const [row] = await tx
      .select(moodColumns)
      .from(s.moodCheckins)
      .where(and(eq(s.moodCheckins.userId, actor.userId), eq(s.moodCheckins.checkinDate, day)));
    if (row) return { mood: row.mood as MoodValue, note: row.note, at: row.at, dismissed: false };
    const [dismissal] = await tx
      .select({ day: s.moodPromptDismissals.promptDate })
      .from(s.moodPromptDismissals)
      .where(and(eq(s.moodPromptDismissals.userId, actor.userId), eq(s.moodPromptDismissals.promptDate, day)));
    return { mood: null, note: null, at: null, dismissed: Boolean(dismissal) };
  });
}

export async function setTodayMood(actor: AuthenticatedActor, input: MoodInput): Promise<TodayMood> {
  const now = new Date();
  return withTenant(actor, async (tx) => {
    const [row] = await tx
      .insert(s.moodCheckins)
      .values({ tenantId: actor.tenantId, userId: actor.userId, checkinDate: todayInBrazil(now), mood: input.mood, note: input.note })
      .onConflictDoUpdate({ target: [s.moodCheckins.userId, s.moodCheckins.checkinDate], set: { mood: input.mood, note: input.note, updatedAt: now } })
      .returning(moodColumns);
    return { mood: row!.mood as MoodValue, note: row!.note, at: row!.at, dismissed: false };
  });
}

/** "Agora não": o modal não volta sozinho hoje (a pessoa ainda pode responder pelo topo). */
export async function dismissTodayMoodPrompt(actor: AuthenticatedActor): Promise<{ dismissed: true }> {
  return withTenant(actor, async (tx) => {
    await tx.insert(s.moodPromptDismissals).values({ tenantId: actor.tenantId, userId: actor.userId, promptDate: todayInBrazil() }).onConflictDoNothing();
    return { dismissed: true as const };
  });
}

/** Sentimento de hoje de cada pessoa da lista (quem não respondeu fica de fora). */
export async function todayMoodsOf(actor: AuthenticatedActor, userIds: string[]): Promise<Map<string, PersonMood>> {
  if (userIds.length === 0) return new Map();
  return withTenant(actor, async (tx) => {
    const rows = await tx
      .select(moodColumns)
      .from(s.moodCheckins)
      .where(and(inArray(s.moodCheckins.userId, userIds), eq(s.moodCheckins.checkinDate, todayInBrazil())));
    return new Map(rows.map((r) => [r.userId, { mood: r.mood as MoodValue, note: r.note, at: r.at }]));
  });
}

export type TeamMember = { id: string; name: string; image: string | null; position: string | null; today: PersonMood | null };

/** Time direto da pessoa (gestão vigente) com o sentimento de hoje. Vazio para quem não é gestor. */
export async function myTeamMoods(actor: AuthenticatedActor): Promise<TeamMember[]> {
  const members = await withTenant(actor, (tx) =>
    tx
      .select({ id: s.users.id, name: s.users.name, image: s.users.image, position: s.positions.name })
      .from(s.managerRelationships)
      .innerJoin(s.users, eq(s.users.id, s.managerRelationships.userId))
      .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
      .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
      .where(and(eq(s.managerRelationships.managerId, actor.userId), isNull(s.managerRelationships.validTo), eq(s.users.status, "active")))
      .orderBy(asc(s.users.name)),
  );
  const moods = await todayMoodsOf(
    actor,
    members.map((m) => m.id),
  );
  return members.map((m) => ({ id: m.id, name: m.name, image: m.image, position: m.position, today: moods.get(m.id) ?? null }));
}
