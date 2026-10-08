import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import type { QuestionType, SurveyDimension } from "@/server/db/schema/surveys";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, HttpError, notFound } from "@/server/http/errors";
import { approveDimensions, dimensionProfiles, generalizedDimensions } from "./dimensions";
import { MAX_COMMENT_LENGTH, type SurveyInput } from "./schemas";

/**
 * Pesquisas anônimas (docs/anonymous-surveys.md).
 *
 * O CORE guarda pesquisa, perguntas e convites (participação, só com a DATA de
 * conclusão). As respostas vão para o cofre `survey_vault` por funções
 * SECURITY DEFINER, em transação separada, sem identidade. Leitura só por
 * agregados com supressão por k (survey_vault.results / breakdown).
 *
 * Este módulo NUNCA loga, audita ou devolve respostas individuais.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
type Rows<T> = { rows: T[] };
const rows = <T>(result: unknown) => (result as Rows<T>).rows;
const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });

const DAY = 24 * 60 * 60 * 1000;
const MAX_OPEN_DAYS = 120;

/* ----------------------------------------------------------- permissões */

const MANAGEMENT_PERMISSIONS: Permission[] = ["survey.design", "survey.launch", "survey.results.read_aggregate"];

function requireTenantWide(actor: AuthenticatedActor, permission: Permission, detail?: string) {
  if (!hasTenantWide(actor, permission)) throw forbidden(detail);
}

/** Pode ver resultados da empresa toda (escopo TENANT). Gestores com escopo de equipe: próxima etapa. */
export function canReadAllResults(actor: AuthenticatedActor) {
  return hasTenantWide(actor, "survey.results.read_aggregate");
}

/* ----------------------------------------------------- encerramento */

/**
 * Encerra pesquisas cujo prazo passou e libera o restante do buffer. Roda
 * antes de qualquer leitura de gestão (sem worker contínuo na Vercel).
 */
async function closeExpired(tx: Tx, tenantId: string) {
  const expired = await tx
    .select({ id: s.surveys.id })
    .from(s.surveys)
    .where(and(eq(s.surveys.status, "active"), lte(s.surveys.closesAt, new Date())));
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
  status: "draft" | "active" | "closed";
  closesAt: Date | null;
  launchedAt: Date | null;
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
        select s.id, s.title, s.kind, s.status, s.closes_at as "closesAt", s.launched_at as "launchedAt", s.anonymity_k as "anonymityK",
               (select count(*)::int from survey_questions q where q.survey_id = s.id) as questions,
               (select count(*)::int from survey_invitations i where i.survey_id = s.id) as invited,
               (select count(*)::int from survey_invitations i where i.survey_id = s.id and i.status = 'completed') as completed
        from surveys s
        ${seesDrafts ? sql`` : sql`where s.status <> 'draft'`}
        order by case s.status when 'active' then 0 when 'draft' then 1 else 2 end, coalesce(s.launched_at, s.created_at) desc`),
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
      anonymityK: s.surveys.anonymityK,
      dimensions: s.surveys.dimensions,
      closesAt: s.surveys.closesAt,
      launchedAt: s.surveys.launchedAt,
      closedAt: s.surveys.closedAt,
    })
    .from(s.surveys)
    .where(eq(s.surveys.id, id));
  if (!survey) throw notFound("Pesquisa não encontrada.");
  return survey;
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
    return { survey, questions: await loadQuestions(tx, id), organizationK: await organizationK(tx) };
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
      .values({ tenantId: actor.tenantId, title: input.title, description: input.description || null, kind: input.kind, anonymityMode: "anonymous", anonymityK: k, createdBy: actor.userId })
      .returning({ id: s.surveys.id });
    await writeQuestions(tx, actor.tenantId, row!.id, input.questions);
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.created", resourceType: "survey", resourceId: row!.id, metadata: { title: input.title, questions: input.questions.length }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateSurvey(actor: AuthenticatedActor, id: string, input: SurveyInput, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "draft") throw conflict("Pesquisas lançadas não podem ser editadas: perguntas, k e dimensões ficam congelados.");
    const k = Math.max(input.anonymityK, await organizationK(tx));
    await tx.update(s.surveys).set({ title: input.title, description: input.description || null, kind: input.kind, anonymityK: k }).where(eq(s.surveys.id, id));
    await writeQuestions(tx, actor.tenantId, id, input.questions);
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.updated", resourceType: "survey", resourceId: id, metadata: { title: input.title, questions: input.questions.length }, ...auditMeta(meta) });
    return { id };
  });
}

export async function deleteSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.design");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "draft") throw conflict("Somente rascunhos podem ser excluídos.");
    await tx.delete(s.surveys).where(eq(s.surveys.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "survey.deleted", resourceType: "survey", resourceId: id, metadata: { title: survey.title }, ...auditMeta(meta) });
  });
}

/**
 * Lança a pesquisa para todas as pessoas ativas: cria os convites, congela o k
 * (nunca abaixo do da empresa) e aprova as dimensões de segmentação.
 */
export async function launchSurvey(actor: AuthenticatedActor, id: string, closesAt: string, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  const closes = new Date(closesAt);
  if (closes.getTime() < Date.now() + 60 * 60 * 1000 || closes.getTime() > Date.now() + MAX_OPEN_DAYS * DAY) {
    throw badRequest(`Escolha um encerramento entre 1 hora e ${MAX_OPEN_DAYS} dias a partir de agora.`);
  }
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "draft") throw conflict("Esta pesquisa já foi lançada.");
    if ((await loadQuestions(tx, id)).length === 0) throw conflict("Inclua ao menos uma pergunta antes de lançar.");
    const k = Math.max(survey.anonymityK, await organizationK(tx));
    const profiles = await dimensionProfiles(tx);
    if (profiles.length < k) throw conflict(`O público precisa ter ao menos ${k} pessoas para preservar o anonimato.`);

    await tx.insert(s.surveyInvitations).values(profiles.map((p) => ({ tenantId: actor.tenantId, surveyId: id, userId: p.userId })));
    const dimensions = approveDimensions(profiles, k);
    await tx.update(s.surveys).set({ status: "active", launchedAt: new Date(), closesAt: closes, anonymityK: k, dimensions }).where(eq(s.surveys.id, id));
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "survey.launched",
      resourceType: "survey",
      resourceId: id,
      metadata: { invited: profiles.length, k, dimensions: Object.keys(dimensions), closesAt: closes.toISOString() },
      ...auditMeta(meta),
    });
    return { id, invited: profiles.length, k };
  });
}

export async function closeSurvey(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireTenantWide(actor, "survey.launch");
  return withTenant(actor, async (tx) => {
    const survey = await loadSurvey(tx, id);
    if (survey.status !== "active") throw conflict("Somente pesquisas em andamento podem ser encerradas.");
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

/**
 * Resultado AGREGADO (empresa toda ou um grupo de uma dimensão aprovada).
 * Tudo que vem do cofre já passou pela supressão primária e complementar.
 */
export async function getSurveyResults(actor: AuthenticatedActor, id: string, filter: { dimension?: SurveyDimension; bucket?: string } = {}) {
  requireTenantWide(actor, "survey.results.read_aggregate", "Resultados por equipe chegam na próxima etapa. Por enquanto, só quem tem acesso à empresa toda vê resultados.");
  return withTenant(actor, async (tx) => {
    await closeExpired(tx, actor.tenantId);
    const survey = await loadSurvey(tx, id);
    if (survey.status === "draft" || survey.anonymityMode !== "anonymous") throw notFound("Pesquisa não encontrada.");
    const questions = await loadQuestions(tx, id);
    const [participation] = rows<{ invited: number; completed: number }>(
      await tx.execute(sql`select count(*)::int as invited, (count(*) filter (where status = 'completed'))::int as completed from survey_invitations where survey_id = ${id}`),
    );
    const dimension = filter.dimension && survey.dimensions[filter.dimension] ? filter.dimension : undefined;
    const groups = dimension ? rows<{ r: Group[] }>(await tx.execute(sql`select survey_vault.breakdown(${id}::uuid, ${dimension}) as r`))[0]!.r : [];
    const bucket = dimension && filter.bucket && groups.some((g) => g.bucket === filter.bucket) ? filter.bucket : undefined;
    const [result] = rows<{ r: VaultResults }>(
      await tx.execute(sql`select survey_vault.results(${id}::uuid, ${bucket ? dimension! : null}::text, ${bucket ?? null}::text) as r`),
    );
    return {
      survey,
      questions,
      participation: participation ?? { invited: 0, completed: 0 },
      dimensions: Object.keys(survey.dimensions) as SurveyDimension[],
      dimension,
      bucket,
      groups,
      results: result!.r,
    };
  });
}

/* ---------------------------------------------------------- colaborador */

export type MySurvey = {
  id: string;
  title: string;
  description: string | null;
  kind: s.SurveyKind;
  closesAt: Date;
  questions: number;
  state: "open" | "answered" | "closed";
};

export async function listMySurveys(actor: AuthenticatedActor): Promise<MySurvey[]> {
  return withTenant(actor, async (tx) => {
    const result = rows<{ id: string; title: string; description: string | null; kind: s.SurveyKind; closesAt: string; status: string; invitation: string; questions: number }>(
      await tx.execute(sql`
        select s.id, s.title, s.description, s.kind, s.closes_at as "closesAt", s.status, i.status as invitation,
               (select count(*)::int from survey_questions q where q.survey_id = s.id) as questions
        from survey_invitations i join surveys s on s.id = i.survey_id
        where i.user_id = ${actor.userId} and s.status <> 'draft'
        order by s.closes_at desc`),
    );
    const now = Date.now();
    return result.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      kind: r.kind,
      closesAt: new Date(r.closesAt),
      questions: r.questions,
      state: r.invitation === "completed" ? "answered" : r.status === "active" && new Date(r.closesAt).getTime() > now ? "open" : "closed",
    }));
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
    const open = survey.status === "active" && survey.closesAt !== null && survey.closesAt.getTime() > Date.now();
    return {
      survey: { id: survey.id, title: survey.title, description: survey.description, kind: survey.kind, closesAt: survey.closesAt, anonymityMode: survey.anonymityMode },
      questions: await loadQuestions(tx, id),
      state: invitation.status === "completed" ? ("answered" as const) : open ? ("open" as const) : ("closed" as const),
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
 * Envio anônimo:
 *  1. Tx core: valida convite e respostas, deriva as dimensões generalizadas e
 *     marca o convite como concluído (só a DATA) — resposta única.
 *  2. Tx cofre (sem usuário no contexto): survey_vault.submit grava no buffer;
 *     o lote vai para as tabelas finais, embaralhado, ao chegar a k.
 * Se a etapa 2 falhar, o convite volta a pendente (nada foi gravado no cofre).
 */
export async function submitSurveyResponse(actor: AuthenticatedActor, surveyId: string, answers: Record<string, number | string>) {
  const { payload, dimensions } = await withTenant(actor, async (tx) => {
    const [invitation] = await tx
      .select({ status: s.surveyInvitations.status })
      .from(s.surveyInvitations)
      .where(and(eq(s.surveyInvitations.surveyId, surveyId), eq(s.surveyInvitations.userId, actor.userId)));
    if (!invitation) throw notFound("Pesquisa não encontrada.");
    if (invitation.status === "completed") throw conflict("Você já respondeu esta pesquisa. Obrigado!");
    const survey = await loadSurvey(tx, surveyId);
    if (survey.status !== "active" || !survey.closesAt || survey.closesAt.getTime() <= Date.now()) throw conflict("Esta pesquisa está encerrada.");
    if (survey.anonymityMode !== "anonymous") throw badRequest("Pesquisas identificadas ainda não são suportadas.");

    const payload = validateAnswers(await loadQuestions(tx, surveyId), answers);
    const [profile] = await dimensionProfiles(tx, actor.userId);
    const dimensions = generalizedDimensions(profile ?? { userId: actor.userId, diretoria: null, area: null, hireDate: null }, survey.dimensions);

    const updated = await tx
      .update(s.surveyInvitations)
      .set({ status: "completed", completedOn: sql`(now() at time zone 'America/Sao_Paulo')::date` })
      .where(and(eq(s.surveyInvitations.surveyId, surveyId), eq(s.surveyInvitations.userId, actor.userId), eq(s.surveyInvitations.status, "pending")))
      .returning({ status: s.surveyInvitations.status });
    if (updated.length === 0) throw conflict("Você já respondeu esta pesquisa. Obrigado!");
    return { payload, dimensions };
  });

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

