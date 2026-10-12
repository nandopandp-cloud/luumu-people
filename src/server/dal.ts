import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { resolveActor, type AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { effectiveFlags } from "@/server/modules/flags/service";
import { friendsBadgeCount } from "@/server/modules/friends/conversations";
import { countUnread } from "@/server/modules/notifications/service";
import { getTodayMood, type TodayMood } from "@/server/modules/wellbeing/service";

/**
 * Data Access Layer para Server Components. Lê a sessão uma vez por request
 * (React cache). Deve ser chamada dentro de um <Suspense> (Cache Components).
 */
export const getCurrentActor = cache(async (): Promise<AuthenticatedActor | null> => resolveActor(await headers()));

export async function requireActor(): Promise<AuthenticatedActor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/entrar");
  return actor;
}

/** Exige a permissão em ALGUM escopo; a checagem por recurso fica nos serviços. */
export async function requirePermission(permission: Permission): Promise<AuthenticatedActor> {
  const actor = await requireActor();
  if (!hasPermissionAnywhere(actor, permission)) forbidden();
  return actor;
}

/** Feature flags efetivas do usuário atual (uma consulta por request). */
export const getCurrentFlags = cache(async (): Promise<Record<string, boolean>> => {
  const actor = await getCurrentActor();
  return actor ? effectiveFlags(actor) : {};
});

/** Conquistas, XP e níveis (flag `gamification`, oculta por padrão). */
export async function achievementsEnabled(): Promise<boolean> {
  return (await getCurrentFlags()).gamification === true;
}

/**
 * Sentimento de hoje da pessoa atual (topo, menu, home, perfil e modal diário).
 * `null` quando a flag `mood_checkin` está desligada para ela.
 */
export const getMyMoodToday = cache(async (): Promise<TodayMood | null> => {
  const actor = await getCurrentActor();
  if (!actor || (await getCurrentFlags()).mood_checkin === false) return null;
  return getTodayMood(actor);
});

/** Notificações não lidas do usuário atual (sino e menu; uma consulta por request). */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const actor = await getCurrentActor();
  return actor ? countUnread(actor) : 0;
});

/** Conversas com mensagens não lidas + pedidos de amizade recebidos (menu "Conversas"). */
export const getFriendsBadgeCount = cache(async (): Promise<number> => {
  const actor = await getCurrentActor();
  return actor ? friendsBadgeCount(actor) : 0;
});
