import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { can, hasTenantWide } from "@/server/authz/policy";
import { accessibleUsersCondition, dbScopeResolver } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import type { ActionInput, ActionUpdate, AssessmentInput, CompetencyInput, GoalInput, GoalUpdate, PdiInput, PdiMentorInput } from "./schemas";

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

/**
 * Quem LANÇA o desenvolvimento (PDI, metas, ações e avaliações) é a liderança:
 * `development.pdi.manage` no escopo da pessoa — nunca a própria pessoa, nem
 * sobre si mesma. O titular só atualiza o andamento e as evidências das ações.
 */
async function canManage(tx: Tx, actor: AuthenticatedActor, userId: string) {
  return userId !== actor.userId && can(actor, "development.pdi.manage", { kind: "user", userId }, dbScopeResolver(tx));
}

async function assertCanManage(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (!(await canManage(tx, actor, userId))) {
    if (userId === actor.userId) throw forbidden("PDI, metas e avaliações são lançados pela sua liderança.");
    await assertCanRead(tx, actor, userId); // fora do escopo de leitura → 404
    throw forbidden("Você pode acompanhar, mas não alterar o desenvolvimento desta pessoa.");
  }
}

/** Campos de uma ação que o próprio titular pode alterar (andamento e evidência). */
const SELF_ACTION_FIELDS = new Set(["status", "evidence", "evidenceUrl"]);

/* -------------------------------------------------------------- leitura */

export type CompetencyRow = {
  id: string;
  name: string;
  category: string;
  icon: string;
  score: number | null;
  /** Nota da avaliação anterior (para a variação "↑ 12%"). */
  previousScore: number | null;
  /** Variação em pontos desde a avaliação anterior (null sem duas avaliações). */
  delta: number | null;
  expected: number;
  source: string | null;
  assessedAt: Date | null;
  level: CompetencyLevel;
};

async function loadCompetencies(tx: Tx, userId: string): Promise<CompetencyRow[]> {
  const result = rows<Omit<CompetencyRow, "level" | "delta">>(
    await tx.execute(sql`
      with current_position as (
        select ea.position_id from employment_assignments ea where ea.user_id = ${userId} and ea.valid_to is null
      ), ranked as (
        select ca.competency_id, ca.score, ca.source, ca.assessed_at,
               row_number() over (partition by ca.competency_id order by ca.assessed_at desc, ca.id desc) as n
        from competency_assessments ca where ca.user_id = ${userId}
      )
      select c.id, c.name, c.category, c.icon,
             latest.score::int as score, previous.score::int as "previousScore", latest.source, latest.assessed_at as "assessedAt",
             coalesce(pc.expected_score, 70)::int as expected
      from competencies c
      left join ranked latest on latest.competency_id = c.id and latest.n = 1
      left join ranked previous on previous.competency_id = c.id and previous.n = 2
      left join position_competencies pc on pc.competency_id = c.id and pc.position_id = (select position_id from current_position)
      where c.archived_at is null
      order by c.name`),
  );
  return result.map((c) => ({
    ...c,
    delta: c.score !== null && c.previousScore !== null ? c.score - c.previousScore : null,
    level: classify(c.score, c.expected),
  }));
}

/** Nível de proficiência (0–5) de uma nota: 20 = Iniciante … 100 = Referência. */
export function proficiencyLevel(score: number): number {
  return Math.max(0, Math.min(5, Math.floor(score / 20)));
}

export type CompetencyMilestone = { competencyId: string; name: string; icon: string; level: number; achievedAt: Date };

/**
 * Conquistas do desenvolvimento, DERIVADAS do histórico de avaliações: cada vez
 * que uma competência alcança um nível de proficiência inédito. Mais recentes primeiro.
 */
async function loadMilestones(tx: Tx, userId: string): Promise<CompetencyMilestone[]> {
  const history = rows<{ competencyId: string; name: string; icon: string; score: number; assessedAt: Date }>(
    await tx.execute(sql`
      select ca.competency_id as "competencyId", c.name, c.icon, ca.score::int as score, ca.assessed_at as "assessedAt"
      from competency_assessments ca join competencies c on c.id = ca.competency_id
      where ca.user_id = ${userId} and c.archived_at is null
      order by ca.competency_id, ca.assessed_at, ca.id`),
  );
  const reached = new Map<string, number>();
  const milestones: CompetencyMilestone[] = [];
  for (const h of history) {
    const level = proficiencyLevel(h.score);
    if (level > (reached.get(h.competencyId) ?? 0)) {
      reached.set(h.competencyId, level);
      milestones.push({ competencyId: h.competencyId, name: h.name, icon: h.icon, level, achievedAt: new Date(h.assessedAt) });
    }
  }
  return milestones.sort((a, b) => b.achievedAt.getTime() - a.achievedAt.getTime());
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
  competencyIcon: string | null;
  targetDate: string | null;
  tags: string[];
  status: string;
  progress: number;
  actions: PdiAction[];
};

export type PdiSummary = { id: string; title: string; status: "active" | "closed"; periodStart: string; periodEnd: string };
export type PdiMentor = { id: string; name: string; image: string | null; position: string | null; active: boolean; note: string | null };
/** Um ponto por mês: progresso do PDI ao fim do mês e ações concluídas no mês. */
export type PdiTimelinePoint = { month: string; progress: number; completed: number };

async function listPdis(tx: Tx, userId: string): Promise<PdiSummary[]> {
  return tx
    .select({ id: s.pdis.id, title: s.pdis.title, status: s.pdis.status, periodStart: s.pdis.periodStart, periodEnd: s.pdis.periodEnd })
    .from(s.pdis)
    .where(eq(s.pdis.userId, userId))
    .orderBy(sql`${s.pdis.status} = 'active' desc`, desc(s.pdis.periodStart));
}

const monthOf = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(date);

function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Evolução do PDI mês a mês (até 6 meses, dentro do ciclo e até o mês atual):
 * média do progresso das metas ao fim de cada mês, pelas datas de conclusão.
 */
function pdiTimeline(period: { periodStart: string; periodEnd: string }, goals: { actions: PdiAction[] }[]): PdiTimelinePoint[] {
  const current = todayBR().slice(0, 7);
  const end = period.periodEnd.slice(0, 7) < current ? period.periodEnd.slice(0, 7) : current;
  const startCandidate = addMonths(end, -5);
  const start = period.periodStart.slice(0, 7) > startCandidate ? period.periodStart.slice(0, 7) : startCandidate;
  const points: PdiTimelinePoint[] = [];
  for (let month = start; month <= end; month = addMonths(month, 1)) {
    const progress = goals.length
      ? goals.reduce((sum, g) => {
          const countable = g.actions.filter((a) => a.status !== "cancelled");
          const done = countable.filter((a) => a.status === "done" && a.completedAt && monthOf(new Date(a.completedAt)) <= month).length;
          return sum + (countable.length ? (done / countable.length) * 100 : 0);
        }, 0) / goals.length
      : 0;
    const completed = goals.flatMap((g) => g.actions).filter((a) => a.status === "done" && a.completedAt && monthOf(new Date(a.completedAt)) === month).length;
    points.push({ month, progress: Math.round(progress), completed });
  }
  return points;
}

/** O PDI escolhido (`pdiId`, se for da pessoa) ou o ativo. */
async function loadPdi(tx: Tx, userId: string, pdiId?: string) {
  const [pdi] = await tx
    .select({
      id: s.pdis.id,
      title: s.pdis.title,
      status: s.pdis.status,
      periodStart: s.pdis.periodStart,
      periodEnd: s.pdis.periodEnd,
      mentorUserId: s.pdis.mentorUserId,
      mentorNote: s.pdis.mentorNote,
    })
    .from(s.pdis)
    .where(and(eq(s.pdis.userId, userId), pdiId ? eq(s.pdis.id, pdiId) : eq(s.pdis.status, "active")));
  if (!pdi) return null;

  let mentor: PdiMentor | null = null;
  if (pdi.mentorUserId) {
    const [m] = rows<Omit<PdiMentor, "note">>(
      await tx.execute(sql`
        select u.id, u.name, u.image, p.name as position, (u.status = 'active') as active from users u
        left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
        left join positions p on p.id = ea.position_id
        where u.id = ${pdi.mentorUserId}`),
    );
    mentor = m ? { ...m, note: pdi.mentorNote } : null;
  }

  const goals = rows<Omit<PdiGoal, "progress" | "actions">>(
    await tx.execute(sql`
      select g.id, g.title, g.description, g.competency_id as "competencyId", c.name as "competencyName", c.icon as "competencyIcon",
             to_char(g.target_date, 'YYYY-MM-DD') as "targetDate", g.tags, g.status
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
    id: pdi.id,
    title: pdi.title,
    status: pdi.status,
    periodStart: pdi.periodStart,
    periodEnd: pdi.periodEnd,
    mentor,
    goals: fullGoals,
    timeline: pdiTimeline(pdi, fullGoals),
    stats: {
      actionsTotal: countable.length,
      actionsDone: countable.filter((a) => a.status === "done").length,
      /** Em andamento e dentro do prazo (atrasadas contam à parte). */
      actionsInProgress: actions.filter((a) => a.status === "in_progress" && !a.late).length,
      actionsNotStarted: actions.filter((a) => a.status === "not_started" && !a.late).length,
      actionsLate: actions.filter((a) => a.late).length,
      progress: fullGoals.length ? Math.round(fullGoals.reduce((sum, g) => sum + g.progress, 0) / fullGoals.length) : 0,
    },
  };
}

export type Development = Awaited<ReturnType<typeof getDevelopment>>;

/** Desenvolvimento completo de uma pessoa (própria ou no escopo do ator); `pdiId` escolhe outro ciclo dela. */
export async function getDevelopment(actor: AuthenticatedActor, userId: string = actor.userId, options: { pdiId?: string } = {}) {
  return withTenant(actor, async (tx) => {
    await assertCanRead(tx, actor, userId);
    const [person] = rows<{ id: string; name: string; image: string | null; position: string | null; orgUnit: string | null }>(
      await tx.execute(sql`
        select u.id, u.name, u.image, p.name as position, ou.name as "orgUnit" from users u
        left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
        left join positions p on p.id = ea.position_id
        left join org_units ou on ou.id = ea.org_unit_id
        where u.id = ${userId}`),
    );
    if (!person) throw notFound();
    const competencyList = await loadCompetencies(tx, userId);
    const pdis = await listPdis(tx, userId);
    // Ciclo pedido que não é da pessoa: cai no ativo (não revela nada de outra pessoa).
    const pdi = await loadPdi(tx, userId, options.pdiId && pdis.some((p) => p.id === options.pdiId) ? options.pdiId : undefined);
    const [milestones, competencyOptions] = [await loadMilestones(tx, userId), await listCompetencyOptions(tx)];
    const counts = {
      developed: competencyList.filter((c) => c.level === "developed").length,
      developing: competencyList.filter((c) => c.level === "developing").length,
      toDevelop: competencyList.filter((c) => c.level === "to_develop").length,
      evolving: competencyList.filter((c) => (c.delta ?? 0) > 0).length,
    };
    const isSelf = userId === actor.userId;
    const manage = await canManage(tx, actor, userId);
    // Ciclo encerrado: só leitura para todo mundo.
    const editable = pdi?.status !== "closed";
    return {
      person,
      competencies: competencyList,
      counts,
      pdi,
      pdis,
      milestones,
      competencyOptions,
      canManage: manage && editable,
      canUpdateProgress: (manage || isSelf) && editable,
      isSelf,
    };
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

export type AssessmentHistoryItem = { id: string; competency: string; score: number; source: string; assessor: string; note: string | null; assessedAt: Date };

/** Histórico de avaliações (mais recentes primeiro). */
export async function listAssessmentHistory(actor: AuthenticatedActor, userId: string = actor.userId, limit = 30) {
  return withTenant(actor, async (tx) => {
    await assertCanRead(tx, actor, userId);
    return rows<AssessmentHistoryItem>(
      await tx.execute(sql`
        select ca.id, c.name as competency, ca.score::int as score, ca.source, u.name as assessor, ca.note, ca.assessed_at as "assessedAt"
        from competency_assessments ca
        join competencies c on c.id = ca.competency_id
        join users u on u.id = ca.assessed_by
        where ca.user_id = ${userId}
        order by ca.assessed_at desc limit ${limit}`),
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
      .values({
        tenantId: actor.tenantId,
        pdiId,
        title: input.title,
        description: input.description ?? null,
        competencyId: input.competencyId ?? null,
        targetDate: input.targetDate ?? null,
        tags: input.tags ?? [],
        position: Number(next),
      })
      .returning({ id: s.pdiGoals.id });
    await audit(tx, actor, pdi.userId, "goal_added", meta);
    return goal!;
  });
}

export async function updateGoal(actor: AuthenticatedActor, goalId: string, input: GoalUpdate, meta: Meta) {
  return withTenant(actor, async (tx) => {
    const [goal] = await tx.select({ pdiId: s.pdiGoals.pdiId }).from(s.pdiGoals).where(eq(s.pdiGoals.id, goalId));
    if (!goal) throw notFound();
    const pdi = await pdiOwner(tx, goal.pdiId);
    await assertCanManage(tx, actor, pdi.userId);
    if (pdi.status !== "active") throw badRequest("Este PDI está encerrado.");
    const changes: Partial<typeof s.pdiGoals.$inferInsert> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description;
    if (input.competencyId !== undefined) changes.competencyId = input.competencyId;
    if (input.targetDate !== undefined) changes.targetDate = input.targetDate;
    if (input.tags !== undefined) changes.tags = input.tags;
    await tx.update(s.pdiGoals).set(changes).where(eq(s.pdiGoals.id, goalId));
    await audit(tx, actor, pdi.userId, "goal_updated", meta, { fields: Object.keys(changes) });
    return { id: goalId };
  });
}

/** Mentoria do ciclo: a liderança escolhe um colega ativo (nunca a própria pessoa) e deixa uma mensagem. */
export async function setPdiMentor(actor: AuthenticatedActor, pdiId: string, input: PdiMentorInput, meta: Meta) {
  return withTenant(actor, async (tx) => {
    const pdi = await pdiOwner(tx, pdiId);
    await assertCanManage(tx, actor, pdi.userId);
    if (pdi.status !== "active") throw badRequest("Este PDI está encerrado.");
    if (input.mentorUserId) {
      if (input.mentorUserId === pdi.userId) throw badRequest("A mentoria precisa ser de outra pessoa.");
      const [mentor] = await tx.select({ status: s.users.status }).from(s.users).where(eq(s.users.id, input.mentorUserId));
      if (mentor?.status !== "active") throw badRequest("Escolha um colaborador ativo da empresa.");
    }
    const note = input.mentorUserId ? (input.mentorNote ?? null) : null;
    await tx.update(s.pdis).set({ mentorUserId: input.mentorUserId, mentorNote: note }).where(eq(s.pdis.id, pdiId));
    await audit(tx, actor, pdi.userId, "mentor_updated", meta);
    return { mentorUserId: input.mentorUserId };
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
    if (pdi.userId === actor.userId) {
      const blocked = Object.keys(input).filter((k) => !SELF_ACTION_FIELDS.has(k));
      if (blocked.length) throw forbidden("Você pode atualizar o andamento e as evidências; o restante da ação é definido pela sua liderança.");
      if (input.status === "cancelled") throw forbidden("Cancelar uma ação é decisão da sua liderança.");
    } else {
      await assertCanManage(tx, actor, pdi.userId);
    }
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
 * Avaliação de competência lançada por quem gere o desenvolvimento da pessoa
 * (gestor ou G&G) — nunca pela própria pessoa. Sempre append-only.
 */
export async function assessCompetency(actor: AuthenticatedActor, input: AssessmentInput, meta: Meta) {
  const userId = input.userId ?? actor.userId;
  return withTenant(actor, async (tx) => {
    await assertCanManage(tx, actor, userId);
    const [competency] = await tx.select({ id: s.competencies.id }).from(s.competencies).where(eq(s.competencies.id, input.competencyId));
    if (!competency) throw notFound("Competência não encontrada.");
    const source = hasTenantWide(actor, "development.pdi.manage") ? "people" : "manager";
    await tx.insert(s.competencyAssessments).values({ tenantId: actor.tenantId, userId, competencyId: input.competencyId, score: input.score, source, assessedBy: actor.userId, note: input.note ?? null });
    await audit(tx, actor, userId, "competency_assessed", meta, { source });
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

export type MatrixCell = { score: number | null; expected: number; level: CompetencyLevel };
export type MatrixRow = { id: string; name: string; position: string | null; orgUnit: string | null; cells: Record<string, MatrixCell> };

/** Mapa de competências: última avaliação de cada pessoa no escopo, por competência. */
export async function getCompetencyMatrix(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const scope = accessibleUsersCondition(actor, "development.read", sql`u.id`);
    const competencies = await listCompetencyOptions(tx);
    const cells = rows<{ userId: string; name: string; position: string | null; orgUnit: string | null; competencyId: string; score: number | null; expected: number }>(
      await tx.execute(sql`
        with scoped as (
          select u.id as user_id, u.name, ea.position_id, p.name as position, ou.name as org_unit from users u
          left join employment_assignments ea on ea.user_id = u.id and ea.valid_to is null
          left join positions p on p.id = ea.position_id
          left join org_units ou on ou.id = ea.org_unit_id
          where u.status = 'active' and u.id <> ${actor.userId} and ${scope}
        ), latest as (
          select distinct on (ca.user_id, ca.competency_id) ca.user_id, ca.competency_id, ca.score
          from competency_assessments ca join scoped on scoped.user_id = ca.user_id
          order by ca.user_id, ca.competency_id, ca.assessed_at desc
        )
        select scoped.user_id as "userId", scoped.name, scoped.position, scoped.org_unit as "orgUnit", c.id as "competencyId",
               latest.score::int as score, coalesce(pc.expected_score, 70)::int as expected
        from scoped cross join competencies c
        left join latest on latest.user_id = scoped.user_id and latest.competency_id = c.id
        left join position_competencies pc on pc.competency_id = c.id and pc.position_id = scoped.position_id
        where c.archived_at is null
        order by scoped.name`),
    );
    const byUser = new Map<string, MatrixRow>();
    for (const c of cells) {
      const row = byUser.get(c.userId) ?? { id: c.userId, name: c.name, position: c.position, orgUnit: c.orgUnit, cells: {} };
      row.cells[c.competencyId] = { score: c.score, expected: c.expected, level: classify(c.score, c.expected) };
      byUser.set(c.userId, row);
    }
    return { competencies, rows: [...byUser.values()] };
  });
}
