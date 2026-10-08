import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { can, hasTenantWide } from "@/server/authz/policy";
import { accessibleUsersCondition, dbScopeResolver } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import type { ActionInput, ActionUpdate, AssessmentInput, CompetencyInput, GoalInput, PdiInput } from "./schemas";

/**
 * Desenvolvimento de pessoas.
 *  - LER o desenvolvimento de alguém: a própria pessoa, ou development.read no escopo.
 *  - ALTERAR (PDI, metas, ações, avaliação como gestor): a própria pessoa no
 *    PRÓPRIO PDI, ou development.pdi.manage no escopo.
 * Fora do escopo → 404 (não revela existência).
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
type Rows<T> = { rows: T[] };
const rows = <T>(r: unknown) => (r as Rows<T>).rows;

export type CompetencyLevel = "developed" | "developing" | "to_develop";

/** Classificação: acima ou no esperado = desenvolvida; até 25 pontos abaixo = em desenvolvimento. */
export function classify(score: number | null, expected: number): CompetencyLevel {
  if (score === null) return "to_develop";
  if (score >= expected) return "developed";
  if (score >= expected - 25) return "developing";
  return "to_develop";
}

export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function assertCanRead(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (userId === actor.userId) return;
  if (!(await can(actor, "development.read", { kind: "user", userId }, dbScopeResolver(tx)))) throw notFound();
}

async function canManage(tx: Tx, actor: AuthenticatedActor, userId: string) {
  return userId === actor.userId || can(actor, "development.pdi.manage", { kind: "user", userId }, dbScopeResolver(tx));
}

async function assertCanManage(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (!(await canManage(tx, actor, userId))) {
    await assertCanRead(tx, actor, userId); // fora do escopo de leitura → 404
    throw forbidden("Você pode acompanhar, mas não alterar o desenvolvimento desta pessoa.");
  }
}

/* -------------------------------------------------------------- leitura */

export type CompetencyRow = {
  id: string;
  name: string;
  category: string;
  icon: string;
  score: number | null;
  expected: number;
  source: string | null;
  assessedAt: Date | null;
  level: CompetencyLevel;
};

async function loadCompetencies(tx: Tx, userId: string): Promise<CompetencyRow[]> {
  const result = rows<Omit<CompetencyRow, "level">>(
    await tx.execute(sql`
      with current_position as (
        select ea.position_id from employment_assignments ea where ea.user_id = ${userId} and ea.valid_to is null
      ), latest as (
        select distinct on (ca.competency_id) ca.competency_id, ca.score, ca.source, ca.assessed_at
        from competency_assessments ca where ca.user_id = ${userId}
        order by ca.competency_id, ca.assessed_at desc
      )
      select c.id, c.name, c.category, c.icon,
             latest.score::int as score, latest.source, latest.assessed_at as "assessedAt",
             coalesce(pc.expected_score, 70)::int as expected
      from competencies c
      left join latest on latest.competency_id = c.id
      left join position_competencies pc on pc.competency_id = c.id and pc.position_id = (select position_id from current_position)
      where c.archived_at is null
      order by c.name`),
  );
  return result.map((c) => ({ ...c, level: classify(c.score, c.expected) }));
}

export type PdiAction = {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  type: string;
  status: "not_started" | "in_progress" | "done" | "cancelled";
  dueDate: string | null;
  late: boolean;
  ownerName: string;
  ownerUserId: string;
  evidence: string | null;
  evidenceUrl: string | null;
  completedAt: Date | null;
};

export type PdiGoal = {
  id: string;
  title: string;
  description: string | null;
  competencyId: string | null;
  competencyName: string | null;
  targetDate: string | null;
  status: string;
  progress: number;
  actions: PdiAction[];
};

async function loadPdi(tx: Tx, userId: string) {
  const [pdi] = await tx
    .select({ id: s.pdis.id, title: s.pdis.title, periodStart: s.pdis.periodStart, periodEnd: s.pdis.periodEnd })
    .from(s.pdis)
    .where(and(eq(s.pdis.userId, userId), eq(s.pdis.status, "active")));
  if (!pdi) return null;

  const goals = rows<Omit<PdiGoal, "progress" | "actions">>(
    await tx.execute(sql`
      select g.id, g.title, g.description, g.competency_id as "competencyId", c.name as "competencyName",
             to_char(g.target_date, 'YYYY-MM-DD') as "targetDate", g.status
      from pdi_goals g left join competencies c on c.id = g.competency_id
      where g.pdi_id = ${pdi.id} and g.status <> 'cancelled'
      order by g.position, g.created_at`),
  );
  const today = todayBR();
  const actions = rows<Omit<PdiAction, "late">>(
    await tx.execute(sql`
      select a.id, a.goal_id as "goalId", a.title, a.description, a.type, a.status,
             to_char(a.due_date, 'YYYY-MM-DD') as "dueDate", u.name as "ownerName", a.owner_user_id as "ownerUserId",
             a.evidence, a.evidence_url as "evidenceUrl", a.completed_at as "completedAt"
      from pdi_actions a join users u on u.id = a.owner_user_id
      where a.pdi_id = ${pdi.id}
      order by a.due_date asc nulls last, a.created_at`),
  ).map((a) => ({ ...a, late: (a.status === "not_started" || a.status === "in_progress") && a.dueDate !== null && a.dueDate < today }));

  const fullGoals: PdiGoal[] = goals.map((g) => {
    const mine = actions.filter((a) => a.goalId === g.id);
    const countable = mine.filter((a) => a.status !== "cancelled");
    const progress = countable.length ? Math.round((countable.filter((a) => a.status === "done").length / countable.length) * 100) : 0;
    return { ...g, progress, actions: mine };
  });
  const countable = actions.filter((a) => a.status !== "cancelled");
  return {
    ...pdi,
    goals: fullGoals,
    stats: {
      actionsTotal: countable.length,
      actionsDone: countable.filter((a) => a.status === "done").length,
      actionsLate: actions.filter((a) => a.late).length,
      progress: fullGoals.length ? Math.round(fullGoals.reduce((sum, g) => sum + g.progress, 0) / fullGoals.length) : 0,
    },
  };
}

export type Development = Awaited<ReturnType<typeof getDevelopment>>;

/** Desenvolvimento completo de uma pessoa (própria ou no escopo do ator). */
export async function getDevelopment(actor: AuthenticatedActor, userId: string = actor.userId) {
  return withTenant(actor, async (tx) => {
    await assertCanRead(tx, actor, userId);
    const [person] = await tx.select({ id: s.users.id, name: s.users.name, image: s.users.image }).from(s.users).where(eq(s.users.id, userId));
    if (!person) throw notFound();
    const [competencyList, pdi, competencyOptions] = [await loadCompetencies(tx, userId), await loadPdi(tx, userId), await listCompetencyOptions(tx)];
    const counts = {
      developed: competencyList.filter((c) => c.level === "developed").length,
      developing: competencyList.filter((c) => c.level === "developing").length,
      toDevelop: competencyList.filter((c) => c.level === "to_develop").length,
    };
    return { person, competencies: competencyList, counts, pdi, competencyOptions, canManage: await canManage(tx, actor, userId), isSelf: userId === actor.userId };
  });
}

async function listCompetencyOptions(tx: Tx) {
  return tx.select({ id: s.competencies.id, name: s.competencies.name }).from(s.competencies).where(sql`${s.competencies.archivedAt} is null`).orderBy(asc(s.competencies.name));
}

/** Evolução mensal da média das competências (últimos N meses, carregando o último valor conhecido). */
export async function getCompetencyEvolution(actor: AuthenticatedActor, userId: string = actor.userId, months = 6) {
  return withTenant(actor, async (tx) => {
    await assertCanRead(tx, actor, userId);
    return rows<{ month: string; average: number | null }>(
      await tx.execute(sql`
        with series as (
          select generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - make_interval(months => ${months - 1}),
                                 date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') as month
        )
        select to_char(series.month, 'YYYY-MM') as month,
               (select round(avg(x.score))::int from (
                  select distinct on (ca.competency_id) ca.score
                  from competency_assessments ca
                  where ca.user_id = ${userId} and ca.assessed_at < series.month + interval '1 month'
                  order by ca.competency_id, ca.assessed_at desc) x) as average
        from series order by series.month`),
    );
  });
}

/* ------------------------------------------------------- visão da gestão */

export type TeamMember = {
  id: string;
  name: string;
  image: string | null;
  position: string | null;
  orgUnit: string | null;
  hasPdi: boolean;
  progress: number;
  actionsTotal: number;
  actionsDone: number;
  actionsLate: number;
  averageScore: number | null;
};

/** Pessoas no escopo de development.read com o resumo do desenvolvimento. */
export async function listTeamDevelopment(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const scope = accessibleUsersCondition(actor, "development.read", sql`u.id`);
    const today = todayBR();
    const members = rows<TeamMember>(
      await tx.execute(sql`
        select u.id, u.name, u.image, p.name as position, ou.name as "orgUnit",
               (pdi.id is not null) as "hasPdi",
               coalesce((select count(*) from pdi_actions a where a.pdi_id = pdi.id and a.status <> 'cancelled'), 0)::int as "actionsTotal",
               coalesce((select count(*) from pdi_actions a where a.pdi_id = pdi.id and a.status = 'done'), 0)::int as "actionsDone",
               coalesce((select count(*) from pdi_actions a where a.pdi_id = pdi.id and a.status in ('not_started', 'in_progress') and a.due_date < ${today}::date), 0)::int as "actionsLate",
               coalesce((select round(avg(g.progress))::int from (
                  select case when count(*) filter (where a.status <> 'cancelled') = 0 then 0
                              else 100.0 * count(*) filter (where a.status = 'done') / count(*) filter (where a.status <> 'cancelled') end as progress
                  from pdi_goals g2 left join pdi_actions a on a.goal_id = g2.id
                  where g2.pdi_id = pdi.id and g2.status <> 'cancelled' group by g2.id) g), 0) as progress,
               (select round(avg(x.score))::int from (
                  select distinct on (ca.competency_id) ca.score from competency_assessments ca
                  where ca.user_id = u.id order by ca.competency_id, ca.assessed_at desc) x) as "averageScore"
        from users u
        left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
        left join positions p on p.id = ea.position_id
        left join org_units ou on ou.id = ea.org_unit_id
        left join pdis pdi on pdi.user_id = u.id and pdi.status = 'active'
        where u.status = 'active' and u.id <> ${actor.userId} and ${scope}
        order by u.name`),
    );
    const withPdi = members.filter((m) => m.hasPdi);
    const totalActions = members.reduce((sum, m) => sum + m.actionsTotal, 0);
    return {
      members,
      kpis: {
        people: members.length,
        withPdiPercent: members.length ? Math.round((withPdi.length / members.length) * 100) : 0,
        actionsDonePercent: totalActions ? Math.round((members.reduce((sum, m) => sum + m.actionsDone, 0) / totalActions) * 100) : 0,
        actionsLate: members.reduce((sum, m) => sum + m.actionsLate, 0),
        averageProgress: withPdi.length ? Math.round(withPdi.reduce((sum, m) => sum + m.progress, 0) / withPdi.length) : 0,
      },
      tenantWide: hasTenantWide(actor, "development.read"),
      canManageCatalog: hasTenantWide(actor, "development.pdi.manage"),
    };
  });
}

/** Lacunas: média atual x média esperada, por competência, entre as pessoas no escopo. */
export async function listTeamCompetencyGaps(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const scope = accessibleUsersCondition(actor, "development.read", sql`u.id`);
    return rows<{ id: string; name: string; average: number | null; expected: number; assessed: number }>(
      await tx.execute(sql`
        with scoped as (
          select u.id as user_id, ea.position_id from users u
          left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
          where u.status = 'active' and u.id <> ${actor.userId} and ${scope}
        ), latest as (
          select distinct on (ca.user_id, ca.competency_id) ca.user_id, ca.competency_id, ca.score
          from competency_assessments ca join scoped on scoped.user_id = ca.user_id
          order by ca.user_id, ca.competency_id, ca.assessed_at desc
        )
        select c.id, c.name,
               round(avg(latest.score))::int as average,
               round(avg(coalesce(pc.expected_score, 70)))::int as expected,
               count(latest.score)::int as assessed
        from competencies c
        cross join scoped
        left join latest on latest.competency_id = c.id and latest.user_id = scoped.user_id
        left join position_competencies pc on pc.competency_id = c.id and pc.position_id = scoped.position_id
        where c.archived_at is null
        group by c.id, c.name
        order by (round(avg(coalesce(pc.expected_score, 70))) - coalesce(round(avg(latest.score)), 0)) desc, c.name`),
    );
  });
}

export async function listCompetencyCatalog(actor: AuthenticatedActor) {
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.competencies.id, name: s.competencies.name, description: s.competencies.description, category: s.competencies.category, icon: s.competencies.icon })
      .from(s.competencies)
      .where(sql`${s.competencies.archivedAt} is null`)
      .orderBy(asc(s.competencies.name)),
  );
}

/* ------------------------------------------------------------ alterações */

async function audit(tx: Tx, actor: AuthenticatedActor, targetUserId: string, what: string, meta: Meta, extra: Record<string, unknown> = {}) {
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: "development.updated",
    resourceType: "user",
    resourceId: targetUserId,
    metadata: { what, ...extra },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
    requestId: meta.requestId,
  });
}

export async function createPdi(actor: AuthenticatedActor, input: PdiInput, meta: Meta) {
  const userId = input.userId ?? actor.userId;
  return withTenant(actor, async (tx) => {
    await assertCanManage(tx, actor, userId);
    const [existing] = await tx.select({ id: s.pdis.id }).from(s.pdis).where(and(eq(s.pdis.userId, userId), eq(s.pdis.status, "active")));
    if (existing) throw conflict("Esta pessoa já tem um PDI ativo.");
    const [pdi] = await tx
      .insert(s.pdis)
      .values({ tenantId: actor.tenantId, userId, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, createdBy: actor.userId })
      .returning({ id: s.pdis.id });
    await audit(tx, actor, userId, "pdi_created", meta);
    return pdi!;
  });
}

async function pdiOwner(tx: Tx, pdiId: string) {
  const [pdi] = await tx.select({ userId: s.pdis.userId, status: s.pdis.status }).from(s.pdis).where(eq(s.pdis.id, pdiId));
  if (!pdi) throw notFound();
  return pdi;
}

export async function addGoal(actor: AuthenticatedActor, pdiId: string, input: GoalInput, meta: Meta) {
  return withTenant(actor, async (tx) => {
    const pdi = await pdiOwner(tx, pdiId);
    await assertCanManage(tx, actor, pdi.userId);
    if (pdi.status !== "active") throw badRequest("Este PDI está encerrado.");
    const [{ next }] = rows<{ next: number }>(await tx.execute(sql`select coalesce(max(position), 0) + 1 as next from pdi_goals where pdi_id = ${pdiId}`));
    const [goal] = await tx
      .insert(s.pdiGoals)
      .values({ tenantId: actor.tenantId, pdiId, title: input.title, description: input.description ?? null, competencyId: input.competencyId ?? null, targetDate: input.targetDate ?? null, position: Number(next) })
      .returning({ id: s.pdiGoals.id });
    await audit(tx, actor, pdi.userId, "goal_added", meta);
    return goal!;
  });
}

export async function addAction(actor: AuthenticatedActor, goalId: string, input: ActionInput, meta: Meta) {
  return withTenant(actor, async (tx) => {
    const [goal] = await tx.select({ pdiId: s.pdiGoals.pdiId }).from(s.pdiGoals).where(eq(s.pdiGoals.id, goalId));
    if (!goal) throw notFound();
    const pdi = await pdiOwner(tx, goal.pdiId);
    await assertCanManage(tx, actor, pdi.userId);
    if (pdi.status !== "active") throw badRequest("Este PDI está encerrado.");
    const ownerUserId = input.ownerUserId ?? pdi.userId;
    if (ownerUserId !== pdi.userId && ownerUserId !== actor.userId) throw badRequest("O responsável deve ser a própria pessoa ou quem está registrando a ação.");
    const [action] = await tx
      .insert(s.pdiActions)
      .values({
        tenantId: actor.tenantId,
        pdiId: goal.pdiId,
        goalId,
        title: input.title,
        description: input.description ?? null,
        type: input.type,
        dueDate: input.dueDate ?? null,
        ownerUserId,
        createdBy: actor.userId,
      })
      .returning({ id: s.pdiActions.id });
    await audit(tx, actor, pdi.userId, "action_added", meta);
    return action!;
  });
}

export async function updateAction(actor: AuthenticatedActor, actionId: string, input: ActionUpdate, meta: Meta) {
  return withTenant(actor, async (tx) => {
    const [action] = await tx.select({ pdiId: s.pdiActions.pdiId, status: s.pdiActions.status }).from(s.pdiActions).where(eq(s.pdiActions.id, actionId));
    if (!action) throw notFound();
    const pdi = await pdiOwner(tx, action.pdiId);
    await assertCanManage(tx, actor, pdi.userId);
    if (pdi.status !== "active") throw badRequest("Este PDI está encerrado.");

    const changes: Partial<typeof s.pdiActions.$inferInsert> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
    if (input.type !== undefined) changes.type = input.type;
    if (input.evidence !== undefined) changes.evidence = input.evidence;
    if (input.evidenceUrl !== undefined) changes.evidenceUrl = input.evidenceUrl;
    if (input.status !== undefined && input.status !== action.status) {
      changes.status = input.status;
      changes.completedAt = input.status === "done" ? new Date() : null;
    }
    if (Object.keys(changes).length === 0) return { id: actionId };
    await tx.update(s.pdiActions).set(changes).where(eq(s.pdiActions.id, actionId));
    await audit(tx, actor, pdi.userId, "action_updated", meta, { fields: Object.keys(changes) });
    return { id: actionId };
  });
}

/**
 * Avaliação de competência: autoavaliação (a própria pessoa) ou avaliação de
 * quem gere o desenvolvimento da pessoa (gestor ou G&G). Sempre append-only.
 */
export async function assessCompetency(actor: AuthenticatedActor, input: AssessmentInput, meta: Meta) {
  const userId = input.userId ?? actor.userId;
  return withTenant(actor, async (tx) => {
    await assertCanManage(tx, actor, userId);
    const [competency] = await tx.select({ id: s.competencies.id }).from(s.competencies).where(eq(s.competencies.id, input.competencyId));
    if (!competency) throw notFound("Competência não encontrada.");
    const source = userId === actor.userId ? "self" : hasTenantWide(actor, "development.pdi.manage") ? "people" : "manager";
    await tx.insert(s.competencyAssessments).values({ tenantId: actor.tenantId, userId, competencyId: input.competencyId, score: input.score, source, assessedBy: actor.userId, note: input.note ?? null });
    if (userId !== actor.userId) await audit(tx, actor, userId, "competency_assessed", meta, { source });
    return { source };
  });
}

export async function createCompetency(actor: AuthenticatedActor, input: CompetencyInput, meta: Meta) {
  if (!hasTenantWide(actor, "development.pdi.manage")) throw forbidden();
  return withTenant(actor, async (tx) => {
    const [existing] = await tx.select({ id: s.competencies.id }).from(s.competencies).where(eq(s.competencies.name, input.name));
    if (existing) throw conflict("Já existe uma competência com esse nome.");
    const [created] = await tx
      .insert(s.competencies)
      .values({ tenantId: actor.tenantId, name: input.name, description: input.description ?? null, category: input.category, icon: input.icon ?? "target" })
      .returning({ id: s.competencies.id });
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "development.updated", resourceType: "competency", resourceId: created!.id, metadata: { what: "competency_created" }, ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });
    return created!;
  });
}
