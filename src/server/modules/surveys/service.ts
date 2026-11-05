import "server-only";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import type { QuestionType, SurveyDimension } from "@/server/db/schema/surveys";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, HttpError, notFound } from "@/server/http/errors";
import { approveDimensions, dimensionProfiles, generalizedDimensions } from "./dimensions";
import { MAX_COMMENT_LENGTH, type LaunchInput, type SurveyDetailsInput, type SurveyInput } from "./schemas";

/**
 * Pesquisas (docs/anonymous-surveys.md). Quem cria escolhe a privacidade:
 *
 *  - ANÔNIMA: o CORE guarda pesquisa, perguntas e convites (participação, só
 *    com a DATA de conclusão). As respostas vão para o cofre `survey_vault` por
 *    funções SECURITY DEFINER, em transação separada, sem identidade. Leitura
 *    só por agregados com supressão por k (survey_vault.results / breakdown).
 *    LIVRE (sem mínimo): o cofre usa k = 1 e não há recortes por grupo.
 *  - IDENTIFICADA: a pessoa é avisada de que responde com nome; a resposta fica
 *    em `survey_identified_responses` e só G&G (`survey.identified.read` na
 *    empresa toda) a lê. Sempre livre.
 *
 * Este módulo NUNCA loga, audita ou devolve respostas individuais de pesquisa anônima.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
type Rows<T> = { rows: T[] };
const rows = <T>(result: unknown) => (result as Rows<T>).rows;
const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });

const DAY = 24 * 60 * 60 * 1000;
const MAX_OPEN_DAYS = 120;
/** Até quanto tempo à frente uma pesquisa pode ser agendada. */
const MAX_SCHEDULE_DAYS = 180;

/* ----------------------------------------------------------- permissões */

const MANAGEMENT_PERMISSIONS: Permission[] = ["survey.design", "survey.launch", "survey.results.read_aggregate"];

function requireTenantWide(actor: AuthenticatedActor, permission: Permission, detail?: string) {
  if (!hasTenantWide(actor, permission)) throw forbidden(detail);
}

/** Anônima COM mínimo (k): a única com público mínimo, liberação em lotes e recortes por grupo. */
export const requiresK = (survey: { anonymityMode: string; noMinimum: boolean }) => survey.anonymityMode === "anonymous" && !survey.noMinimum;

/** Identificada é sempre livre (o k protege anonimato, que ela não promete). */
const privacyOf = (input: Pick<SurveyInput, "anonymityMode" | "noMinimum">) => ({ anonymityMode: input.anonymityMode, noMinimum: input.anonymityMode === "identified" || input.noMinimum });

/** Pode ver resultados da empresa toda (escopo TENANT). Gestores com escopo de equipe: próxima etapa. */
export function canReadAllResults(actor: AuthenticatedActor) {
  return hasTenantWide(actor, "survey.results.read_aggregate");
}

/* ----------------------------------------------------- encerramento */

/**
 * Encerra pesquisas cujo prazo passou e libera o restante do buffer. Roda
 * antes de qualquer leitura de gestão (sem worker contínuo na Vercel).
 */
export async function closeExpired(tx: Tx, tenantId: string) {
  const expired = await tx
    .select({ id: s.surveys.id })
    .from(s.surveys)
    .where(and(inArray(s.surveys.status, ["active", "paused"]), lte(s.surveys.closesAt, new Date())));
  for (const { id } of expired) {
    await tx.update(s.surveys).set({ status: "closed", closedAt: new Date() }).where(eq(s.surveys.id, id));
    await tx.execute(sql`select survey_vault.close(${id}::uuid)`);
    await recordAudit(tx, { tenantId, actorUserId: null, action: "survey.closed", resourceType: "survey", resourceId: id, metadata: { automatic: true } });
  }
}

/* --------------------------------------------------------------- gestão */

export type ManagedSurvey = {
  id: string;
  title: string;
  kind: s.SurveyKind;
  status: "draft" | "active" | "paused" | "closed";
  closesAt: Date | null;
  launchedAt: Date | null;
  anonymityMode: "anonymous" | "identified";
  noMinimum: boolean;
  anonymityK: number;
  questions: number;
  invited: number;
  completed: number;
};

export async function listManagedSurveys(actor: AuthenticatedActor) {
  if (!MANAGEMENT_PERMISSIONS.some((p) => hasPermissionAnywhere(actor, p))) throw forbidden();
  const seesDrafts = hasTenantWide(actor, "survey.design") || hasTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    return rows<ManagedSurvey>(
      await tx.execute(sql`
        select s.id, s.title, s.kind, s.status, s.closes_at as "closesAt", s.launched_at as "launchedAt", s.anonymity_mode as "anonymityMode", s.no_minimum as "noMinimum", s.anonymity_k as "anonymityK",
               (select count(*)::int from survey_questions q where q.survey_id = s.id) as questions,
               (select count(*)::int from survey_invitations i where i.survey_id = s.id) as invited,
               (select count(*)::int from survey_invitations i where i.survey_id = s.id and i.status = 'completed') as completed
        from surveys s
        ${seesDrafts ? sql`` : sql`where s.status <> 'draft'`}
        order by case s.status when 'active' then 0 when 'paused' then 1 when 'draft' then 2 else 3 end, coalesce(s.launched_at, s.created_at) desc`),
    ).map((r) => ({ ...r, closesAt: r.closesAt && new Date(r.closesAt), launchedAt: r.launchedAt && new Date(r.launchedAt) }));
  });
}

async function loadSurvey(tx: Tx, id: string) {
  const [survey] = await tx
    .select({
      id: s.surveys.id,
      title: s.surveys.title,
      description: s.surveys.description,
      kind: s.surveys.kind,
      status: s.surveys.status,
      anonymityMode: s.surveys.anonymityMode,
      noMinimum: s.surveys.noMinimum,
      anonymityK: s.surveys.anonymityK,
      dimensions: s.surveys.dimensions,
      closesAt: s.surveys.closesAt,
      launchedAt: s.surveys.launchedAt,
      closedAt: s.surveys.closedAt,
    })
    .from(s.surveys)
    .where(eq(s.surveys.id, id));
  if (!survey) throw notFound("Pesquisa não encontrada.");
  // Agendada: lançada com início no futuro (o cofre só aceita respostas a partir dele).
  const scheduled = (survey.status === "active" || survey.status === "paused") && survey.launchedAt !== null && survey.launchedAt.getTime() > Date.now();
  return { ...survey, scheduled };
}

/** Áreas do público (vazio = empresa toda). */
async function loadAudience(tx: Tx, surveyId: string) {
  return tx
    .select({ id: s.orgUnits.id, name: s.orgUnits.name })
    .from(s.surveyAudienceUnits)
    .innerJoin(s.orgUnits, eq(s.orgUnits.id, s.surveyAudienceUnits.orgUnitId))
    .where(eq(s.surveyAudienceUnits.surveyId, surveyId))
    .orderBy(asc(s.orgUnits.name));
}

async function loadQuestions(tx: Tx, surveyId: string) {
  return tx
    .select({ id: s.surveyQuestions.id, type: s.surveyQuestions.type, text: s.surveyQuestions.text, options: s.surveyQuestions.options, required: s.surveyQuestions.required })
    .from(s.surveyQuestions)
    .where(eq(s.surveyQuestions.surveyId, surveyId))
    .orderBy(asc(s.surveyQuestions.position));
}

export async function getManagedSurvey(actor: AuthenticatedActor, id: string) {
  if (!MANAGEMENT_PERMISSIONS.some((p) => hasPermissionAnywhere(actor, p))) throw forbidden();
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status === "draft" && !(hasTenantWide(actor, "survey.design") || hasTenantWide(actor, "survey.launch"))) throw notFound("Pesquisa não encontrada.");
    return { survey, questions: await loadQuestions(tx, id), audience: await loadAudience(tx, id), organizationK: await organizationK(tx) };
  });
}

/** k mínimo da empresa (para o builder). */
export async function getOrganizationK(actor: AuthenticatedActor) {
  return withTenant(actor, organizationK);
}

async function organizationK(tx: Tx) {
  const [org] = await tx.select({ k: s.organizations.anonymityK }).from(s.organizations);
  return org?.k ?? 5;
}

async function writeQuestions(tx: Tx, tenantId: string, surveyId: string, questions: SurveyInput["questions"]) {
  await tx.delete(s.surveyQuestions).where(eq(s.surveyQuestions.surveyId, surveyId));
  await tx.insert(s.surveyQuestions).values(
    questions.map((q, i) => ({ tenantId, surveyId, position: i + 1, type: q.type, text: q.text, options: q.type === "choice" ? (q.options ?? []) : null, required: q.required })),
  );
}

export async function createSurvey(actor: AuthenticatedActor, input: SurveyInput, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const k = Math.max(input.anonymityK, await organizationK(tx));
    const [row] = await tx
      .insert(s.surveys)
      .values({ tenantId: actor.tenantId, title: input.title, description: input.description || null, kind: input.kind, ...privacyOf(input), anonymityK: k, createdBy: actor.userId })
      .returning({ id: s.surveys.id });
    await writeQuestions(tx, actor.tenantId, row!.id, input.questions);
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.created", resourceType: "survey", resourceId: row!.id, metadata: { title: input.title, questions: input.questions.length, ...privacyOf(input) }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateSurvey(actor: AuthenticatedActor, id: string, input: SurveyInput, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "draft") throw conflict("Pesquisas lançadas não podem ser editadas: perguntas, k e dimensões ficam congelados.");
    const k = Math.max(input.anonymityK, await organizationK(tx));
    await tx.update(s.surveys).set({ title: input.title, description: input.description || null, kind: input.kind, ...privacyOf(input), anonymityK: k }).where(eq(s.surveys.id, id));
    await writeQuestions(tx, actor.tenantId, id, input.questions);
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.updated", resourceType: "survey", resourceId: id, metadata: { title: input.title, questions: input.questions.length, ...privacyOf(input) }, ...auditMeta(meta) });
    return { id };
  });
}

/**
 * Exclui a pesquisa. Rascunho: direto. Lançada (em andamento, pausada ou
 * encerrada): pelo cofre (`survey_vault.purge`), que apaga junto as respostas
 * anônimas — sem lê-las. A auditoria guarda só título, situação e participação.
 */
export async function deleteSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status === "draft") {
      await tx.delete(s.surveys).where(eq(s.surveys.id, id));
    } else {
      if (!hasTenantWide(actor, "survey.launch")) throw forbidden("Excluir uma pesquisa lançada exige também a permissão de lançar pesquisas.");
      const [participation] = rows<{ invited: number; completed: number }>(
        await tx.execute(sql`select count(*)::int as invited, count(*) filter (where status = 'completed')::int as completed from survey_invitations where survey_id = ${id}`),
      );
      await tx.execute(sql`select survey_vault.purge(${id}::uuid)`);
      await recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "survey.deleted",
        resourceType: "survey",
        resourceId: id,
        metadata: { title: survey.title, status: survey.status, invited: participation?.invited ?? 0, completed: participation?.completed ?? 0 },
        ...auditMeta(meta),
      });
      return;
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.deleted", resourceType: "survey", resourceId: id, metadata: { title: survey.title }, ...auditMeta(meta) });
  });
}

/** Copia a pesquisa (perguntas, tipo, privacidade e k) como um novo rascunho. */
export async function duplicateSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    const questions = await loadQuestions(tx, id);
    const title = `${survey.title} (cópia)`.slice(0, 120);
    const [row] = await tx
      .insert(s.surveys)
      .values({ tenantId: actor.tenantId, title, description: survey.description, kind: survey.kind, anonymityMode: survey.anonymityMode, noMinimum: survey.noMinimum, anonymityK: survey.anonymityK, createdBy: actor.userId })
      .returning({ id: s.surveys.id });
    if (questions.length) {
      await writeQuestions(
        tx,
        actor.tenantId,
        row!.id,
        questions.map((q) => ({ type: q.type, text: q.text, options: q.options ?? undefined, required: q.required })),
      );
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.created", resourceType: "survey", resourceId: row!.id, metadata: { title, duplicatedFrom: id }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

/** Encerramento entre 1 hora e MAX_OPEN_DAYS depois do início (agora, se não agendada). */
function assertClosesAt(closesAt: string, opens = new Date()) {
  const closes = new Date(closesAt);
  const from = Math.max(opens.getTime(), Date.now());
  if (closes.getTime() < from + 60 * 60 * 1000 || closes.getTime() > from + MAX_OPEN_DAYS * DAY) {
    throw badRequest(`Escolha um encerramento entre 1 hora e ${MAX_OPEN_DAYS} dias depois do início.`);
  }
  return closes;
}

/** Início agendado: no futuro, até MAX_SCHEDULE_DAYS. Sem data (ou no passado próximo) = agora. */
function assertOpensAt(opensAt: string | undefined) {
  if (!opensAt) return new Date();
  const opens = new Date(opensAt);
  if (opens.getTime() <= Date.now()) return new Date();
  if (opens.getTime() > Date.now() + MAX_SCHEDULE_DAYS * DAY) throw badRequest(`Agende o início para até ${MAX_SCHEDULE_DAYS} dias a partir de hoje.`);
  return opens;
}

/** Pessoas ativas com lotação vigente em qualquer das áreas (e subáreas). */
async function audienceUserIds(tx: Tx, orgUnitIds: string[]) {
  const result = rows<{ id: string }>(
    await tx.execute(sql`
      with recursive tree(id) as (
        select ou.id from org_units ou where ou.id in ${orgUnitIds}
        union
        select ou.id from org_units ou join tree t on ou.parent_id = t.id
      )
      select distinct ea.user_id as id from employment_assignments ea join users u on u.id = ea.user_id
      where ea.valid_to is null and u.status = 'active' and ea.org_unit_id in (select id from tree)`),
  );
  return new Set(result.map((r) => r.id));
}

/** Confere que todas as áreas existem na empresa (a RLS limita ao tenant) e tira repetições. */
async function assertOrgUnits(tx: Tx, orgUnitIds: string[]) {
  const ids = [...new Set(orgUnitIds)];
  if (ids.length === 0) return ids;
  const found = await tx.select({ id: s.orgUnits.id }).from(s.orgUnits).where(inArray(s.orgUnits.id, ids));
  if (found.length !== ids.length) throw badRequest("Área do público não encontrada.");
  return ids;
}

/** Tamanho do público (para o diálogo de lançamento) e o k da empresa. Sem áreas = empresa toda. */
export async function getAudienceSize(actor: AuthenticatedActor, orgUnitIds: string[]) {
  requireTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    const k = await organizationK(tx);
    const ids = await assertOrgUnits(tx, orgUnitIds);
    if (ids.length === 0) return { size: (await dimensionProfiles(tx)).length, k };
    return { size: (await audienceUserIds(tx, ids)).size, k };
  });
}

/**
 * Pesquisa lançada: título e descrição (`survey.design`) e prazo (`survey.launch`,
 * só enquanto não encerrou). Perguntas, k e dimensões continuam congelados.
 */
export async function updateSurveyDetails(actor: AuthenticatedActor, id: string, input: SurveyDetailsInput, meta: Meta) {
  if ((input.title !== undefined || input.description !== undefined) && !hasTenantWide(actor, "survey.design")) throw forbidden();
  if (input.closesAt !== undefined && !hasTenantWide(actor, "survey.launch")) throw forbidden();
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status === "draft") throw conflict("Edite o rascunho pelo editor de pesquisa.");
    const changes: Partial<typeof s.surveys.$inferInsert> = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description || null;
    if (input.closesAt !== undefined) {
      if (survey.status === "closed") throw conflict("Pesquisa encerrada não muda de prazo.");
      changes.closesAt = assertClosesAt(input.closesAt, survey.launchedAt ?? undefined);
    }
    await tx.update(s.surveys).set(changes).where(eq(s.surveys.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.updated", resourceType: "survey", resourceId: id, metadata: { fields: Object.keys(changes) }, ...auditMeta(meta) });
    return { id };
  });
}

/** Pausa: ninguém responde até retomar (o prazo continua correndo). */
export async function pauseSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "active") throw conflict("Somente pesquisas em andamento podem ser pausadas.");
    await tx.update(s.surveys).set({ status: "paused" }).where(eq(s.surveys.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.paused", resourceType: "survey", resourceId: id, ...auditMeta(meta) });
    return { id };
  });
}

/** Retoma uma pesquisa pausada; com `closesAt`, ajusta o prazo ao mesmo tempo. */
export async function resumeSurvey(actor: AuthenticatedActor, id: string, closesAt: string | undefined, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "paused") throw conflict("Somente pesquisas pausadas podem ser retomadas.");
    const closes = closesAt ? assertClosesAt(closesAt, survey.launchedAt ?? undefined) : survey.closesAt;
    if (!closes || closes.getTime() < Date.now() + 60 * 60 * 1000) throw badRequest("O prazo está acabando: escolha um novo encerramento para retomar.");
    await tx.update(s.surveys).set({ status: "active", closesAt: closes }).where(eq(s.surveys.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.resumed", resourceType: "survey", resourceId: id, metadata: { closesAt: closes.toISOString() }, ...auditMeta(meta) });
    return { id };
  });
}

/**
 * Lança a pesquisa para o público (empresa toda ou áreas): cria os convites,
 * congela o k (nunca abaixo do da empresa) e, só na anônima com mínimo, aprova
 * as dimensões de segmentação e exige ao menos k pessoas no público. Livre e
 * identificada: qualquer público com ao menos 1 pessoa, sem recortes.
 */
export async function launchSurvey(actor: AuthenticatedActor, id: string, input: LaunchInput, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  const opens = assertOpensAt(input.opensAt);
  const closes = assertClosesAt(input.closesAt, opens);
  const scheduled = opens.getTime() > Date.now();
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "draft") throw conflict("Esta pesquisa já foi lançada.");
    if ((await loadQuestions(tx, id)).length === 0) throw conflict("Inclua ao menos uma pergunta antes de lançar.");
    const k = Math.max(survey.anonymityK, await organizationK(tx));
    const audience = await assertOrgUnits(tx, input.audienceOrgUnitIds ?? []);
    const members = audience.length ? await audienceUserIds(tx, audience) : null;
    const profiles = (await dimensionProfiles(tx)).filter((p) => !members || members.has(p.userId));
    const withK = requiresK(survey);
    if (withK && profiles.length < k) throw conflict(`O público precisa ter ao menos ${k} pessoas para preservar o anonimato.`);
    if (profiles.length === 0) throw conflict("Não há pessoas ativas no público escolhido.");

    await tx.insert(s.surveyInvitations).values(profiles.map((p) => ({ tenantId: actor.tenantId, surveyId: id, userId: p.userId })));
    // O público entra enquanto a pesquisa ainda é rascunho (o trigger congela depois).
    if (audience.length) await tx.insert(s.surveyAudienceUnits).values(audience.map((orgUnitId) => ({ tenantId: actor.tenantId, surveyId: id, orgUnitId })));
    const dimensions = withK ? approveDimensions(profiles, k) : {};
    await tx.update(s.surveys).set({ status: "active", launchedAt: opens, closesAt: closes, anonymityK: k, dimensions }).where(eq(s.surveys.id, id));
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "survey.launched",
      resourceType: "survey",
      resourceId: id,
      metadata: {
        invited: profiles.length,
        k: withK ? k : null,
        anonymityMode: survey.anonymityMode,
        noMinimum: survey.noMinimum,
        dimensions: Object.keys(dimensions),
        closesAt: closes.toISOString(),
        opensAt: opens.toISOString(),
        scheduled,
        audience: audience.length ? audience : "company",
      },
      ...auditMeta(meta),
    });
    return { id, invited: profiles.length, k: withK ? k : null, scheduled };
  });
}

export async function closeSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "active" && survey.status !== "paused") throw conflict("Somente pesquisas em andamento ou pausadas podem ser encerradas.");
    await tx.update(s.surveys).set({ status: "closed", closedAt: new Date() }).where(eq(s.surveys.id, id));
    await tx.execute(sql`select survey_vault.close(${id}::uuid)`);
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.closed", resourceType: "survey", resourceId: id, ...auditMeta(meta) });
    return { id };
  });
}

/* ------------------------------------------------------------ resultados */

export type QuestionResult = {
  questionId: string;
  answered: number;
  suppressed: boolean;
  average: number | null;
  distribution: Record<string, number> | null;
  comments: string[] | null;
};
export type VaultResults = { suppressed: true } | { suppressed: false; responses: number; questions: QuestionResult[] };
export type Group = { bucket: string; responses: number };
/** Resposta de pesquisa IDENTIFICADA (só para quem tem survey.identified.read na empresa toda). */
export type IdentifiedResponse = { userId: string; name: string; image: string | null; orgUnit: string | null; submittedAt: Date; answers: Record<string, number | string> };

async function identifiedResponses(tx: Tx, surveyId: string): Promise<IdentifiedResponse[]> {
  return rows<Omit<IdentifiedResponse, "submittedAt"> & { submittedAt: string }>(
    await tx.execute(sql`
      select r.user_id as "userId", u.name, u.image, ou.name as "orgUnit", r.submitted_at as "submittedAt", r.answers
      from survey_identified_responses r
      join users u on u.id = r.user_id
      left join employment_assignments ea on ea.user_id = r.user_id and ea.valid_to is null
      left join org_units ou on ou.id = ea.org_unit_id
      where r.survey_id = ${surveyId}
      order by u.name`),
  ).map((r) => ({ ...r, submittedAt: new Date(r.submittedAt) }));
}

/** Agregados de uma pesquisa identificada, no mesmo formato do cofre (sem supressão: não há anonimato a proteger). */
export function aggregateIdentified(questions: { id: string; type: QuestionType }[], responses: Pick<IdentifiedResponse, "answers">[]): VaultResults {
  return {
    suppressed: false,
    responses: responses.length,
    questions: questions.map((q) => {
      const values = responses.map((r) => r.answers[q.id]).filter((v): v is number | string => v !== undefined && v !== "");
      const numbers = values.filter((v): v is number => typeof v === "number");
      const distribution: Record<string, number> = {};
      if (q.type !== "text") for (const v of values) distribution[String(v)] = (distribution[String(v)] ?? 0) + 1;
      return {
        questionId: q.id,
        answered: values.length,
        suppressed: false,
        average: (q.type === "scale" || q.type === "enps") && numbers.length ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100 : null,
        distribution: q.type === "text" ? null : distribution,
        comments: q.type === "text" ? values.filter((v): v is string => typeof v === "string") : null,
      };
    }),
  };
}

/**
 * Resultados. Anônima: AGREGADO do cofre (empresa toda ou um grupo de uma
 * dimensão aprovada), já com supressão primária e complementar. Identificada:
 * agregados + respostas por pessoa, só para `survey.identified.read` na empresa toda.
 */
export async function getSurveyResults(actor: AuthenticatedActor, id: string, filter: { dimension?: SurveyDimension; bucket?: string } = {}) {
  requireTenantWide(actor, "survey.results.read_aggregate", "Resultados por equipe chegam na próxima etapa. Por enquanto, só quem tem acesso à empresa toda vê resultados.");
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status === "draft") throw notFound("Pesquisa não encontrada.");
    const questions = await loadQuestions(tx, id);
    const audience = await loadAudience(tx, id);
    const [participation] = rows<{ invited: number; completed: number }>(
      await tx.execute(sql`select count(*)::int as invited, (count(*) filter (where status = 'completed'))::int as completed from survey_invitations where survey_id = ${id}`),
    );
    if (survey.anonymityMode === "identified") {
      if (!hasTenantWide(actor, "survey.identified.read")) throw forbidden("Somente o time de Gente e Gestão vê respostas de pesquisas identificadas.");
      const individual = await identifiedResponses(tx, id);
      return {
        survey,
        questions,
        audience,
        participation: participation ?? { invited: 0, completed: 0 },
        dimensions: [] as SurveyDimension[],
        dimension: undefined,
        bucket: undefined,
        groups: [] as Group[],
        results: aggregateIdentified(questions, individual),
        individual,
      };
    }
    const dimension = filter.dimension && survey.dimensions[filter.dimension] ? filter.dimension : undefined;
    const groups = dimension ? rows<{ r: Group[] }>(await tx.execute(sql`select survey_vault.breakdown(${id}::uuid, ${dimension}) as r`))[0]!.r : [];
    const bucket = dimension && filter.bucket && groups.some((g) => g.bucket === filter.bucket) ? filter.bucket : undefined;
    const [result] = rows<{ r: VaultResults }>(
      await tx.execute(sql`select survey_vault.results(${id}::uuid, ${bucket ? dimension! : null}::text, ${bucket ?? null}::text) as r`),
    );
    return {
      survey,
      questions,
      audience,
      participation: participation ?? { invited: 0, completed: 0 },
      dimensions: Object.keys(survey.dimensions) as SurveyDimension[],
      dimension,
      bucket,
      groups,
      results: result!.r,
      individual: null as IdentifiedResponse[] | null,
    };
  });
}

/* ---------------------------------------------------------- colaborador */

export type MySurvey = {
  id: string;
  title: string;
  description: string | null;
  kind: s.SurveyKind;
  anonymous: boolean;
  /** Pesquisa livre (sem mínimo de respostas). */
  noMinimum: boolean;
  closesAt: Date;
  questions: number;
  /** Tempo estimado para responder, em minutos (≈15 s por pergunta fechada, 45 s por texto livre). */
  estimatedMinutes: number;
  /** Dias de calendário (Brasília) até o dia do encerramento: 0 = encerra hoje. */
  daysLeft: number;
  /** Parte do prazo (lançamento → encerramento) que ainda resta, de 0 a 100. */
  timeLeftPercent: number;
  /** Data (aaaa-mm-dd) em que a PRÓPRIA pessoa respondeu — o convite guarda só a data. */
  completedOn: string | null;
  state: "open" | "answered" | "closed";
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Dia (aaaa-mm-dd) no fuso de Brasília. */
const brDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

export async function listMySurveys(actor: AuthenticatedActor): Promise<MySurvey[]> {
  return withTenant(actor, async (tx) => {
    const result = rows<{
      id: string;
      title: string;
      description: string | null;
      kind: s.SurveyKind;
      anonymityMode: string;
      noMinimum: boolean;
      closesAt: string;
      launchedAt: string | null;
      status: string;
      invitation: string;
      completedOn: string | null;
      questions: number;
      textQuestions: number;
    }>(
      await tx.execute(sql`
        select s.id, s.title, s.description, s.kind, s.anonymity_mode as "anonymityMode", s.no_minimum as "noMinimum", s.closes_at as "closesAt", s.launched_at as "launchedAt",
               s.status, i.status as invitation, i.completed_on::text as "completedOn",
               (select count(*)::int from survey_questions q where q.survey_id = s.id) as questions,
               (select count(*)::int from survey_questions q where q.survey_id = s.id and q.type = 'text') as "textQuestions"
        from survey_invitations i join surveys s on s.id = i.survey_id
        where i.user_id = ${actor.userId} and s.status <> 'draft' and s.launched_at <= now() and (s.status <> 'paused' or i.status = 'completed')
        order by s.closes_at desc`),
    );
    const now = Date.now();
    return result.map((r) => {
      const closesAt = new Date(r.closesAt);
      const launchedAt = r.launchedAt ? new Date(r.launchedAt) : null;
      const left = Math.max(0, closesAt.getTime() - now);
      const span = launchedAt ? closesAt.getTime() - launchedAt.getTime() : 0;
      const closedQuestions = r.questions - r.textQuestions;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        kind: r.kind,
        anonymous: r.anonymityMode === "anonymous",
        noMinimum: r.noMinimum,
        closesAt,
        questions: r.questions,
        estimatedMinutes: Math.max(1, Math.ceil((closedQuestions * 15 + r.textQuestions * 45) / 60)),
        daysLeft: Math.max(0, Math.round((Date.parse(brDay(closesAt)) - Date.parse(brDay(new Date(now)))) / DAY_MS)),
        timeLeftPercent: span > 0 ? Math.round((left / span) * 100) : 0,
        completedOn: r.invitation === "completed" ? r.completedOn : null,
        state: r.invitation === "completed" ? "answered" : r.status === "active" && closesAt.getTime() > now ? "open" : "closed",
      };
    });
  });
}

/** Pesquisa para responder: só com convite da PRÓPRIA pessoa. */
export async function getSurveyToAnswer(actor: AuthenticatedActor, id: string) {
  return withTenant(actor, async (tx) => {
    const [invitation] = await tx
      .select({ status: s.surveyInvitations.status })
      .from(s.surveyInvitations)
      .where(and(eq(s.surveyInvitations.surveyId, id), eq(s.surveyInvitations.userId, actor.userId)));
    if (!invitation) throw notFound("Pesquisa não encontrada.");
    const survey = await loadSurvey(tx, id);
    // Agendada (início no futuro): para o colaborador, ainda não existe.
    if (!survey.launchedAt || survey.launchedAt.getTime() > Date.now()) throw notFound("Pesquisa não encontrada.");
    const open = survey.status === "active" && survey.closesAt !== null && survey.closesAt.getTime() > Date.now();
    return {
      survey: { id: survey.id, title: survey.title, description: survey.description, kind: survey.kind, closesAt: survey.closesAt, anonymityMode: survey.anonymityMode, noMinimum: survey.noMinimum },
      questions: await loadQuestions(tx, id),
      state: invitation.status === "completed" ? ("answered" as const) : open ? ("open" as const) : survey.status === "paused" ? ("paused" as const) : ("closed" as const),
    };
  });
}

type Question = { id: string; type: QuestionType; options: string[] | null; required: boolean };

/** Valida as respostas contra as perguntas. Erros nunca repetem o conteúdo enviado. */
export function validateAnswers(questions: Question[], answers: Record<string, number | string>): Record<string, number | string> {
  const known = new Set(questions.map((q) => q.id));
  if (Object.keys(answers).some((key) => !known.has(key))) throw badRequest("Há respostas para perguntas que não fazem parte desta pesquisa.");
  const out: Record<string, number | string> = {};
  for (const q of questions) {
    const raw = answers[q.id];
    const value = typeof raw === "string" ? raw.trim() : raw;
    if (value === undefined || value === "") {
      if (q.required) throw badRequest("Responda todas as perguntas obrigatórias.");
      continue;
    }
    const valid =
      q.type === "scale"
        ? typeof value === "number" && value >= 1 && value <= 5
        : q.type === "enps"
          ? typeof value === "number" && value >= 0 && value <= 10
          : q.type === "choice"
            ? typeof value === "string" && (q.options ?? []).includes(value)
            : typeof value === "string" && value.length <= MAX_COMMENT_LENGTH;
    if (!valid) throw badRequest("Alguma resposta não está no formato esperado. Revise e envie novamente.");
    out[q.id] = value;
  }
  return out;
}

/**
 * Envio.
 * Identificada: numa única transação, conclui o convite e grava a resposta com
 * o id da pessoa (a interface avisou que a pesquisa é identificada).
 * Anônima:
 *  1. Tx core: valida convite e respostas, deriva as dimensões generalizadas e
 *     marca o convite como concluído (só a DATA) — resposta única.
 *  2. Tx cofre (sem usuário no contexto): survey_vault.submit grava no buffer;
 *     o lote vai para as tabelas finais, embaralhado, ao chegar a k (livre: 1).
 * Se a etapa 2 falhar, o convite volta a pendente (nada foi gravado no cofre).
 */
export async function submitSurveyResponse(actor: AuthenticatedActor, surveyId: string, answers: Record<string, number | string>) {
  const prepared = await withTenant(actor, async (tx) => {
    const [invitation] = await tx
      .select({ status: s.surveyInvitations.status })
      .from(s.surveyInvitations)
      .where(and(eq(s.surveyInvitations.surveyId, surveyId), eq(s.surveyInvitations.userId, actor.userId)));
    if (!invitation) throw notFound("Pesquisa não encontrada.");
    if (invitation.status === "completed") throw conflict("Você já respondeu esta pesquisa. Obrigado!");
    const survey = await loadSurvey(tx, surveyId);
    if (!survey.launchedAt || survey.launchedAt.getTime() > Date.now()) throw notFound("Pesquisa não encontrada.");
    if (survey.status === "paused") throw conflict("Esta pesquisa está pausada. Tente novamente mais tarde.");
    if (survey.status !== "active" || !survey.closesAt || survey.closesAt.getTime() <= Date.now()) throw conflict("Esta pesquisa está encerrada.");

    const payload = validateAnswers(await loadQuestions(tx, surveyId), answers);
    const completed = await tx
      .update(s.surveyInvitations)
      .set({ status: "completed", completedOn: sql`(now() at time zone 'America/Sao_Paulo')::date` })
      .where(and(eq(s.surveyInvitations.surveyId, surveyId), eq(s.surveyInvitations.userId, actor.userId), eq(s.surveyInvitations.status, "pending")))
      .returning({ status: s.surveyInvitations.status });
    if (completed.length === 0) throw conflict("Você já respondeu esta pesquisa. Obrigado!");

    if (survey.anonymityMode === "identified") {
      await tx.insert(s.surveyIdentifiedResponses).values({ tenantId: actor.tenantId, surveyId, userId: actor.userId, answers: payload });
      return null;
    }

    const [profile] = await dimensionProfiles(tx, actor.userId);
    const dimensions = generalizedDimensions(profile ?? { userId: actor.userId, diretoria: null, area: null, hireDate: null }, survey.dimensions);
    return { payload, dimensions };
  });
  if (!prepared) return;
  const { payload, dimensions } = prepared;

  try {
    await withTenant({ tenantId: actor.tenantId, userId: null }, (tx) =>
      tx.execute(sql`select survey_vault.submit(${surveyId}::uuid, ${JSON.stringify(dimensions)}::jsonb, ${JSON.stringify(payload)}::jsonb)`),
    );
  } catch {
    // O erro do banco pode conter as respostas: não é registrado nem repassado.
    await withTenant(actor, (tx) =>
      tx
        .update(s.surveyInvitations)
        .set({ status: "pending", completedOn: null })
        .where(and(eq(s.surveyInvitations.surveyId, surveyId), eq(s.surveyInvitations.userId, actor.userId))),
    );
    throw new HttpError(503, "Não foi possível registrar sua resposta", "Nada foi gravado. Tente novamente em instantes.");
  }
}

