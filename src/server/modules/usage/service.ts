import "server-only";
import { sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden } from "@/server/http/errors";
import { touchPresenceIn } from "@/server/modules/friends/conversations";

/**
 * Uso da plataforma: acessos, pessoas únicas e tempo de uso.
 *  - GRAVAR: cada pessoa, o próprio sinal (junto com a presença).
 *  - LER: só agregados, para quem vê relatórios da empresa toda.
 */

type Rows<T> = { rows: T[] };
const rows = <T>(r: unknown) => (r as Rows<T>).rows;

const TODAY = sql`(now() at time zone 'America/Sao_Paulo')::date`;
/** Sem sinal por mais que isso, o próximo é um novo acesso. */
const NEW_VISIT_AFTER = sql`interval '30 minutes'`;
/** Teto de cada intervalo somado ao tempo de uso (o sinal vem a cada minuto). */
const MAX_GAP_SECONDS = 120;

export async function recordUsage(actor: AuthenticatedActor) {
  await withTenant(actor, (tx) => recordUsageIn(tx, actor));
}

/** Sinal periódico da aba aberta: presença e uso na MESMA transação (uma ida ao banco por batida). */
export async function recordActivity(actor: AuthenticatedActor) {
  await withTenant(actor, async (tx) => {
    await touchPresenceIn(tx, actor);
    await recordUsageIn(tx, actor);
  });
}

async function recordUsageIn(tx: Tx, actor: AuthenticatedActor) {
  const u = s.usageDays;
  await tx
    .insert(u)
    .values({ tenantId: actor.tenantId, userId: actor.userId, day: sql`${TODAY}` })
    .onConflictDoUpdate({
      target: [u.tenantId, u.userId, u.day],
      set: {
        visits: sql`case when ${u.lastSeenAt} < now() - ${NEW_VISIT_AFTER} then ${u.visits} + 1 else ${u.visits} end`,
        activeSeconds: sql`${u.activeSeconds} + case when ${u.lastSeenAt} >= now() - ${NEW_VISIT_AFTER} then least(extract(epoch from now() - ${u.lastSeenAt}), ${MAX_GAP_SECONDS})::int else 0 end`,
        lastSeenAt: sql`now()`,
      },
      // Abas duplicadas ou foco repetido não contam duas vezes.
      setWhere: sql`${u.lastSeenAt} < now() - interval '20 seconds'`,
    });
}

export const USAGE_PERIODS = [7, 30] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export type UsageDay = { day: string; visits: number; users: number };
type Totals = { visits: number; users: number; avgSeconds: number };

/** Variação percentual frente ao período anterior (null sem base de comparação). */
const change = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);

export async function getPlatformUsage(actor: AuthenticatedActor, period: UsagePeriod) {
  if (!hasTenantWide(actor, "reports.read")) throw forbidden();
  return withTenant(actor, async (tx) => {
    const days = rows<UsageDay>(
      await tx.execute(sql`
        select d.day::date::text as day, coalesce(sum(u.visits), 0)::int as visits, count(u.user_id)::int as users
        from generate_series(${TODAY} - ${period - 1}::int, ${TODAY}, interval '1 day') as d(day)
        left join usage_days u on u.day = d.day::date
        group by d.day order by d.day`),
    );
    const totals = async (from: number, to: number) =>
      rows<Totals>(
        await tx.execute(sql`
          select coalesce(sum(visits), 0)::int as visits, count(distinct user_id)::int as users,
                 coalesce(round(avg(active_seconds)), 0)::int as "avgSeconds"
          from usage_days where day between ${TODAY} - ${from}::int and ${TODAY} - ${to}::int`),
      )[0]!;
    const current = await totals(period - 1, 0);
    const previous = await totals(2 * period - 1, period);
    return {
      period,
      days,
      totals: current,
      changes: {
        visits: change(current.visits, previous.visits),
        users: change(current.users, previous.users),
        avgSeconds: change(current.avgSeconds, previous.avgSeconds),
      },
    };
  });
}
