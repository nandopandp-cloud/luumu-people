import "server-only";
import { and, asc, count, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { accessibleUsersCondition } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

/**
 * Indicadores do dashboard de gestão. Cada número só é calculado se o ator
 * tiver a permissão correspondente — e sempre dentro do seu escopo.
 */

type Rows<T> = { rows: T[] };
const rows = <T>(r: unknown) => (r as Rows<T>).rows;

const TODAY = sql`(now() at time zone 'America/Sao_Paulo')::date`;

export async function getManagementOverview(actor: AuthenticatedActor) {
  const canPeople = hasPermissionAnywhere(actor, "people.directory.read");

  return withTenant(actor, async (tx) => {
    const scope = accessibleUsersCondition(actor, "people.directory.read", sql`u.id`);

    const people = canPeople
      ? rows<{ active: number; headcountNow: number; headcountBefore: number; recentHires: number; pendingInvites: number }>(
          await tx.execute(sql`
            select
              (select count(*) from users u where u.status = 'active' and ${scope})::int as active,
              (select count(distinct ea.user_id) from employment_assignments ea join users u on u.id = ea.user_id
                where ea.valid_from <= ${TODAY} and (ea.valid_to is null or ea.valid_to > ${TODAY}) and ${scope})::int as "headcountNow",
              (select count(distinct ea.user_id) from employment_assignments ea join users u on u.id = ea.user_id
                where ea.valid_from <= ${TODAY} - 30 and (ea.valid_to is null or ea.valid_to > ${TODAY} - 30) and ${scope})::int as "headcountBefore",
              (select count(*) from employee_profiles ep join users u on u.id = ep.user_id
                where u.status = 'active' and ep.hire_date > ${TODAY} - 30 and ep.hire_date <= ${TODAY} and ${scope})::int as "recentHires",
              (select count(*) from users u where u.status = 'invited' and ${scope})::int as "pendingInvites"`),
        )[0]!
      : null;

    const orgUnits = canPeople ? (await tx.select({ value: count() }).from(s.orgUnits).where(isNull(s.orgUnits.archivedAt)))[0]!.value : null;

    const managers =
      canPeople && hasTenantWide(actor, "people.directory.read")
        ? (
            await tx
              .select({ value: sql<number>`count(distinct ${s.managerRelationships.managerId})::int` })
              .from(s.managerRelationships)
              .where(isNull(s.managerRelationships.validTo))
          )[0]!.value
        : null;

    return {
      peopleInScope: people?.active ?? null,
      /** Variação do quadro (lotações vigentes) frente a 30 dias atrás, em %. */
      peopleChange: people && people.headcountBefore > 0 ? Math.round(((people.headcountNow - people.headcountBefore) / people.headcountBefore) * 1000) / 10 : null,
      recentHires: people?.recentHires ?? null,
      pendingInvites: people?.pendingInvites ?? null,
      orgUnits,
      managers,
    };
  });
}

export type AttentionItems = {
  /** PDIs ativos com ao menos uma ação vencida (no escopo de development.read). */
  latePdis: number | null;
  /** Pesquisas em andamento que encerram nos próximos 7 dias. */
  closingSurveys: { id: string; title: string }[] | null;
  /** Pessoas convidadas que ainda não ativaram o acesso. */
  pendingInvites: number | null;
};

/** "Atenção necessária": cada item só é calculado com a permissão correspondente. */
export async function getAttentionItems(actor: AuthenticatedActor): Promise<AttentionItems> {
  return withTenant(actor, async (tx) => {
    const latePdis = hasPermissionAnywhere(actor, "development.read")
      ? rows<{ value: number }>(
          await tx.execute(sql`
            select count(*)::int as value from pdis p join users u on u.id = p.user_id
            where p.status = 'active' and u.status = 'active' and u.id <> ${actor.userId}
              and ${accessibleUsersCondition(actor, "development.read", sql`u.id`)}
              and exists (select 1 from pdi_actions a where a.pdi_id = p.id and a.status in ('not_started', 'in_progress') and a.due_date < ${TODAY})`),
        )[0]!.value
      : null;

    const closingSurveys = hasPermissionAnywhere(actor, "survey.launch")
      ? await tx
          .select({ id: s.surveys.id, title: s.surveys.title })
          .from(s.surveys)
          .where(and(eq(s.surveys.status, "active"), gte(s.surveys.closesAt, sql`now()`), lte(s.surveys.closesAt, sql`now() + interval '7 days'`)))
          .orderBy(asc(s.surveys.closesAt))
      : null;

    const pendingInvites = hasPermissionAnywhere(actor, "people.directory.read")
      ? rows<{ value: number }>(
          await tx.execute(sql`select count(*)::int as value from users u where u.status = 'invited' and ${accessibleUsersCondition(actor, "people.directory.read", sql`u.id`)}`),
        )[0]!.value
      : null;

    return { latePdis, closingSurveys, pendingInvites };
  });
}
