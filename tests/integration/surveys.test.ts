import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as submitRoute from "@/app/api/v1/me/surveys/[id]/responses/route";
import * as closeRoute from "@/app/api/v1/surveys/[id]/close/route";
import * as launchRoute from "@/app/api/v1/surveys/[id]/launch/route";
import * as resultsRoute from "@/app/api/v1/surveys/[id]/results/route";
import * as surveysRoute from "@/app/api/v1/surveys/route";
import { resolveActor } from "@/server/auth/session";
import { ALL_PERMISSIONS } from "@/server/authz/permissions";
import * as s from "@/server/db/schema";
import { defineRoute } from "@/server/http/route";
import { logger } from "@/server/observability/logger";
import { getSurveyResults, listMySurveys } from "@/server/modules/surveys/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

type Row = Record<string, unknown>;
const rowsOf = async <T extends Row>(statement: ReturnType<typeof sql>) => ((await (await testDatabase()).db.execute(statement)) as unknown as { rows: T[] }).rows;

async function session(key: string) {
  const s1 = await signIn("aurora", key);
  return { ...s1, actor: (await resolveActor(headersWith(s1.cookie)))! };
}

async function surveyId(title: string) {
  const { db } = await testDatabase();
  const tenant = await tenantOf("aurora");
  const [row] = await db.select({ id: s.surveys.id }).from(s.surveys).where(and(eq(s.surveys.tenantId, tenant.tenantId), eq(s.surveys.title, title)));
  return row!.id;
}

const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

/** Pesquisa nova (1 escala + 1 texto opcional), lançada para toda a empresa. */
async function launchedSurvey(title: string) {
  const admin = await session("juliana");
  const created = await call(surveysRoute.POST, {
    path: "/api/v1/surveys",
    method: "POST",
    cookie: admin.cookie,
    body: {
      title,
      kind: "pulse",
      questions: [
        { type: "scale", text: "Estou satisfeito(a) com o meu trabalho." },
        { type: "text", text: "Comentário", required: false },
      ],
    },
  });
  expect(created.status).toBe(200);
  const id = created.json.id as string;
  const launched = await call(launchRoute.POST, { path: "/x", method: "POST", cookie: admin.cookie, params: { id }, body: { closesAt: inAWeek() } });
  expect(launched.status).toBe(200);
  const [scale, text] = await (await testDatabase()).db
    .select({ id: s.surveyQuestions.id })
    .from(s.surveyQuestions)
    .where(eq(s.surveyQuestions.surveyId, id))
    .orderBy(s.surveyQuestions.position);
  return { id, scaleId: scale!.id, textId: text!.id, admin };
}

async function answer(key: string, id: string, answers: Record<string, number | string>) {
  const { cookie } = await signIn("aurora", key);
  return call(submitRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: { answers } });
}

describe("pesquisas anônimas", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("resultados da pesquisa de clima: só agregados, com o lote liberado", async () => {
    const { actor } = await session("paula");
    const id = await surveyId("Pesquisa de Clima 2026");
    const data = await getSurveyResults(actor, id);
    expect(data.results.suppressed).toBe(false);
    if (data.results.suppressed) return;
    // Só sai do buffer em lotes: o que falta liberar é sempre menor que k.
    expect(data.participation.completed - data.results.responses).toBeGreaterThanOrEqual(0);
    expect(data.participation.completed - data.results.responses).toBeLessThan(data.survey.anonymityK);
    expect(data.results.questions).toHaveLength(8);
    const enps = data.results.questions[5]!;
    expect(enps.average).toBeGreaterThan(0);
    expect(Object.values(enps.distribution ?? {}).reduce((a, b) => a + b, 0)).toBe(enps.answered);
    // Texto livre: só a lista de comentários, sem nada que os identifique.
    expect(JSON.stringify(data.results.questions[7])).not.toMatch(/userId|email|date|dimension/i);
  });

  it("colaborador vê as próprias pesquisas e não responde duas vezes", async () => {
    const { actor } = await session("fernando");
    const mine = await listMySurveys(actor);
    expect(mine.find((m) => m.title === "Pesquisa de Clima 2026")?.state).toBe("open");
    expect(mine.find((m) => m.title.startsWith("eNPS"))?.state).toBe("closed");
    expect(mine.some((m) => m.title === "Pulso de bem-estar")).toBe(false);

    const open = mine.find((m) => m.title === "Pesquisa de Clima 2026")!;
    expect(open).toMatchObject({ anonymous: true, estimatedMinutes: 3, completedOn: null });
    expect(open.daysLeft).toBeGreaterThan(0);
    expect(open.timeLeftPercent).toBeGreaterThan(0);
    expect(open.timeLeftPercent).toBeLessThanOrEqual(100);

    // Quem respondeu vê só a DATA da própria resposta (o convite não guarda hora).
    const { db } = await testDatabase();
    const [done] = await db.select({ userId: s.surveyInvitations.userId }).from(s.surveyInvitations).where(eq(s.surveyInvitations.status, "completed")).limit(1);
    const respondent = [...(await tenantOf("aurora")).users.entries()].find(([, u]) => u.id === done!.userId)![0];
    const answered = (await listMySurveys((await session(respondent)).actor)).filter((m) => m.state === "answered");
    expect(answered.length).toBeGreaterThan(0);
    for (const m of answered) expect(m.completedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("TESTE 1 — ninguém lê resposta individual: catálogo, API e SQL da aplicação", async () => {
    expect(ALL_PERMISSIONS.filter((p) => /individual|raw|response/i.test(p))).toEqual([]);
    const id = await surveyId("Pesquisa de Clima 2026");
    for (const key of ["fernando", "rafael", "carla"]) {
      const { cookie } = await signIn("aurora", key);
      const res = await call(resultsRoute.GET, { path: `/api/v1/surveys/${id}/results`, cookie, params: { id } });
      expect(res.status, key).toBe(403);
    }
    for (const table of ["anon_submission_buffer", "anon_response", "anon_answer", "anon_response_dimension"]) {
      await expectDbError(asRole("luumu_app", (db) => db.execute(sql.raw(`select * from survey_vault.${table} limit 1`))), /permission denied/);
    }
    const helpers = await rowsOf<{ f: string; ok: boolean }>(sql`
      select f, has_function_privilege('luumu_app', f, 'EXECUTE') as ok from unnest(array[
        'survey_vault._flush(uuid)', 'survey_vault._buckets(uuid, text, integer)', 'survey_vault._survey_k(uuid)'
      ]) as f`);
    expect(helpers.filter((h) => h.ok)).toEqual([]);
  });

  it("lote só é liberado com k respostas; resposta única; validação sem eco", async () => {
    const { id, scaleId, admin } = await launchedSurvey("Pulso de teste: lotes");
    const results = async () => (await getSurveyResults(admin.actor, id)).results;

    for (const key of ["fernando", "gabriel", "helena", "lucas"]) {
      expect((await answer(key, id, { [scaleId]: 4 })).status, key).toBe(204);
      expect(await results()).toEqual({ suppressed: true });
    }
    const bad = await answer("camila", id, { [scaleId]: 9 });
    expect(bad.status).toBe(400);
    expect(bad.json.detail).not.toMatch(/9/);
    expect(bad.json.errors).toBeUndefined();
    expect((await answer("camila", id, { [scaleId]: 2 })).status).toBe(204);
    const released = await results();
    expect(released).toMatchObject({ suppressed: false, responses: 5 });

    expect((await answer("camila", id, { [scaleId]: 5 })).status).toBe(409);
    const [inv] = await rowsOf<{ completed_on: string }>(sql`select completed_on::text from survey_invitations i join users u on u.id = i.user_id where i.survey_id = ${id} and u.email like 'camila.%'`);
    expect(inv!.completed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("TESTES 2 e 3 — grupo pequeno e ataque por diferença → suprimidos", async () => {
    const { id, scaleId, admin } = await launchedSurvey("Pulso de teste: diferença");
    const [survey] = await rowsOf<{ dimensions: Record<string, string[]> }>(sql`select dimensions from surveys where id = ${id}`);
    // Área "Dados" tem 3 pessoas (< k): nem chega a ser uma dimensão aprovada.
    expect(survey!.dimensions.area).not.toContain("Dados");
    expect(survey!.dimensions.diretoria).toContain("Tecnologia");

    // 6 de Tecnologia + 2 de Gente & Gestão (+ 3 de Dados, que viram "Outros" na área).
    for (const key of ["fernando", "gabriel", "helena", "lucas", "camila", "bruno", "eduardo", "marcos", "renata", "felipe", "sofia"]) {
      expect((await answer(key, id, { [scaleId]: 3 })).status, key).toBe(204);
    }
    expect((await call(closeRoute.POST, { path: "/x", method: "POST", cookie: admin.cookie, params: { id } })).status).toBe(200);

    const total = await getSurveyResults(admin.actor, id);
    expect(total.results).toMatchObject({ suppressed: false, responses: 11 });

    // Diretoria: G&G (2) < k. Mostrar Tecnologia (9 com Dados) permitiria
    // deduzir o resto por diferença — a generalização junta tudo em "Outros".
    const byDirectorate = await getSurveyResults(admin.actor, id, { dimension: "diretoria" });
    for (const g of byDirectorate.groups) expect(g.responses).toBeGreaterThanOrEqual(5);
    expect(byDirectorate.groups.reduce((n, g) => n + g.responses, 0)).toBe(11);
    expect(byDirectorate.groups.map((g) => g.bucket)).toEqual(["Outros"]);

    const app = (statement: ReturnType<typeof sql>) =>
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${(await tenantOf("aurora")).tenantId}, true)`);
        return ((await db.execute(statement)) as unknown as { rows: { r: unknown }[] }).rows[0]!.r;
      });
    expect(await app(sql`select survey_vault.results(${id}::uuid, 'diretoria', 'Tecnologia') as r`)).toEqual({ suppressed: true });
    expect(await app(sql`select survey_vault.results(${id}::uuid, 'area', 'Dados') as r`)).toEqual({ suppressed: true });
    // Dimensão não aprovada no lançamento não pode ser usada.
    await expectDbError(app(sql`select survey_vault.results(${id}::uuid, 'cargo', 'Head') as r`), /dimensão não aprovada/);
  });

  it("TESTE 4 — cofre sem identidade, sem timestamp e sem FK para o core", async () => {
    const columns = await rowsOf<{ table_name: string; column_name: string; data_type: string }>(sql`
      select table_name, column_name, data_type from information_schema.columns where table_schema = 'survey_vault'`);
    expect(columns.length).toBeGreaterThan(8);
    expect(columns.filter((c) => /user|email|name|tenant|created|updated|_at$|_on$|time|ip|agent|session/i.test(c.column_name))).toEqual([]);
    expect(columns.filter((c) => /time|date/i.test(c.data_type))).toEqual([]);

    const fks = await rowsOf<{ conname: string }>(sql`
      select c.conname from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
      join pg_class ref on ref.oid = c.confrelid join pg_namespace rn on rn.oid = ref.relnamespace
      where c.contype = 'f' and (n.nspname = 'survey_vault') <> (rn.nspname = 'survey_vault')`);
    expect(fks).toEqual([]);

    const grants = await rowsOf<{ table_name: string }>(sql`
      select table_name from information_schema.role_table_grants where table_schema = 'survey_vault' and grantee in ('luumu_app', 'luumu_auth', 'PUBLIC')`);
    expect(grants).toEqual([]);

    const definer = await rowsOf<{ proname: string; prosecdef: boolean }>(sql`
      select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'survey_vault'`);
    expect(definer.length).toBeGreaterThanOrEqual(6);
    expect(definer.filter((f) => !f.prosecdef)).toEqual([]);

    // Convite: só a data; nenhuma coluna de horário.
    const invitation = await rowsOf<{ column_name: string }>(sql`
      select column_name from information_schema.columns where table_schema = 'public' and table_name = 'survey_invitations' and data_type like 'timestamp%'`);
    expect(invitation).toEqual([]);
  });

  it("TESTE 5 — conteúdo da resposta não vai para auditoria nem para logs", async () => {
    const { id, scaleId, textId } = await launchedSurvey("Pulso de teste: sentinela");
    const SENTINEL = "SENTINELA-7f3c-nao-pode-vazar";
    const log = logger();
    const spies = (["fatal", "error", "warn", "info", "debug", "trace"] as const).map((level) => vi.spyOn(log, level));
    try {
      expect((await answer("fernando", id, { [scaleId]: 5, [textId]: SENTINEL })).status).toBe(204);
      for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(SENTINEL);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    const audit = await rowsOf<{ n: number }>(sql`select count(*)::int as n from audit_logs where audit_logs::text like ${`%${SENTINEL}%`}`);
    expect(audit[0]!.n).toBe(0);
    const recorded = await rowsOf<{ n: number }>(sql`select count(*)::int as n from audit_logs where resource_id = ${id} and action not in ('survey.created', 'survey.launched')`);
    expect(recorded[0]!.n).toBe(0);
  });

  it("rota anônima: erro inesperado não loga erro, caminho nem usuário", async () => {
    const { cookie } = await signIn("aurora", "fernando");
    const handler = defineRoute({
      permission: "authenticated",
      anonymous: true,
      handler: async () => {
        throw new Error("falha com SENTINELA-anon");
      },
    });
    const spy = vi.spyOn(logger(), "error");
    try {
      const res = await call(handler, { path: "/api/v1/me/surveys/x/responses", method: "POST", cookie, body: {} });
      expect(res.status).toBe(500);
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/SENTINELA|responses|fernando/);
    } finally {
      spy.mockRestore();
    }
  });

  it("TESTE 6 — anonimato, k, dimensões e perguntas congelam no lançamento", async () => {
    const { db } = await testDatabase();
    const { id } = await launchedSurvey("Pulso de teste: imutável");
    await expectDbError(db.execute(sql`update surveys set anonymity_mode = 'identified' where id = ${id}`), /imutável/);
    await db.execute(sql`update surveys set anonymity_k = 7 where id = ${id}`);
    await expectDbError(db.execute(sql`update surveys set anonymity_k = 5 where id = ${id}`), /só pode aumentar/);
    await expectDbError(db.execute(sql`update surveys set dimensions = '{}' where id = ${id}`), /congelam/);
    await expectDbError(db.execute(sql`update survey_questions set text = 'outra' where survey_id = ${id}`), /congelam/);
    await expectDbError(db.execute(sql`delete from surveys where id = ${id}`), /não pode ser excluída/);
    await expectDbError(db.execute(sql`update surveys set status = 'draft' where id = ${id}`), /transição/);
    // O runtime nem tem privilégio para alterar o modo de anonimato.
    await expectDbError(
      asRole("luumu_app", async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${(await tenantOf("aurora")).tenantId}, true)`);
        await tx.execute(sql`update surveys set anonymity_mode = 'anonymous' where id = ${id}`);
      }),
      /permission denied/,
    );
  });

  it("pesquisa de outra empresa é invisível (404)", async () => {
    const { db } = await testDatabase();
    const horizonte = await tenantOf("horizonte");
    const [other] = await db.select({ id: s.surveys.id }).from(s.surveys).where(eq(s.surveys.tenantId, horizonte.tenantId)).limit(1);
    const { actor } = await session("paula");
    await expect(getSurveyResults(actor, other!.id)).rejects.toMatchObject({ status: 404 });
    const res = await answer("fernando", other!.id, {});
    expect(res.status).toBe(404);
  });
});

