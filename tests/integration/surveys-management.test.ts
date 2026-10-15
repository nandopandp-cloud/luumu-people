import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as submitRoute from "@/app/api/v1/me/surveys/[id]/responses/route";
import * as audienceRoute from "@/app/api/v1/surveys/audience/route";
import * as exportRoute from "@/app/api/v1/surveys/export/route";
import * as launchRoute from "@/app/api/v1/surveys/[id]/launch/route";
import * as surveysRoute from "@/app/api/v1/surveys/route";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { enpsFromDistribution, getSurveyKpis, listSurveyDirectory, type SurveyListQuery } from "@/server/modules/surveys/overview";
import { getSurveyToAnswer, listMySurveys } from "@/server/modules/surveys/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

type Row = Record<string, unknown>;
const rowsOf = async <T extends Row>(statement: ReturnType<typeof sql>) => ((await (await testDatabase()).db.execute(statement)) as unknown as { rows: T[] }).rows;

async function session(key: string) {
  const s1 = await signIn("aurora", key);
  return { ...s1, actor: (await resolveActor(headersWith(s1.cookie)))! };
}

const DAY = 24 * 60 * 60 * 1000;
const iso = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const query = (patch: Partial<SurveyListQuery> = {}): SurveyListQuery => ({ sort: "status", dir: "asc", page: 1, perPage: 50, ...patch });

async function draft(title: string) {
  const admin = await session("juliana");
  const created = await call(surveysRoute.POST, {
    path: "/api/v1/surveys",
    method: "POST",
    cookie: admin.cookie,
    body: { title, kind: "pulse", questions: [{ type: "scale", text: "Estou satisfeito(a) com o meu trabalho." }] },
  });
  expect(created.status).toBe(200);
  return { id: created.json.id as string, admin };
}

/** A área com mais gente (≥ k) e a menor área com gente (para o caso "público pequeno"). */
async function areas() {
  const tenant = await tenantOf("aurora");
  const list = await rowsOf<{ id: string; n: number }>(sql`
    select ou.id, count(*)::int as n from org_units ou
    join employment_assignments ea on ea.org_unit_id = ou.id and ea.valid_to is null
    join users u on u.id = ea.user_id and u.status = 'active'
    where ou.tenant_id = ${tenant.tenantId} and ou.type = 'area' and not exists (select 1 from org_units c where c.parent_id = ou.id)
    group by ou.id order by n desc`);
  return { big: list[0]!, small: list.at(-1)! };
}

describe("pesquisas: gestão (lista, indicadores, agendamento e público)", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("lista com abas, busca, tipo, público e paginação; agendada aparece como 'scheduled'", async () => {
    const { actor } = await session("paula");
    const all = await listSurveyDirectory(actor, query());
    expect(all.counts.all).toBe(all.counts.ativas + all.counts.agendadas + all.counts.encerradas + all.counts.rascunhos);
    expect(all.counts.agendadas).toBeGreaterThanOrEqual(1);
    expect(all.counts.rascunhos).toBeGreaterThanOrEqual(1);

    const scheduled = await listSurveyDirectory(actor, query({ tab: "agendadas" }));
    expect(scheduled.items.every((r) => r.displayStatus === "scheduled" && r.rate === null)).toBe(true);
    expect(scheduled.items.map((r) => r.title)).toContain("eNPS — 2º semestre de 2026");

    expect((await listSurveyDirectory(actor, query({ search: "clima" }))).items.map((r) => r.title)).toContain("Pesquisa de Clima 2026");
    expect((await listSurveyDirectory(actor, query({ kind: "enps" }))).items.every((r) => r.kind === "enps")).toBe(true);

    const byArea = await listSurveyDirectory(actor, query({ audience: "empresa" }));
    expect(byArea.items.every((r) => r.audienceOrgUnitId === null)).toBe(true);
    const area = all.items.find((r) => r.audienceOrgUnitId !== null)!;
    expect(area.audienceName).toBeTruthy();
    expect(area.audienceSize).toBe(area.invited);
    expect((await listSurveyDirectory(actor, query({ audience: area.audienceOrgUnitId! }))).items.map((r) => r.id)).toEqual([area.id]);

    const page = await listSurveyDirectory(actor, query({ perPage: 2, page: 2 }));
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(page.total).toBe(all.total);
  });

  it("indicadores: totais, taxa média e eNPS médio só de resultados liberados", async () => {
    const { actor } = await session("paula");
    const kpis = await getSurveyKpis(actor);
    expect(kpis.total.value).toBeGreaterThan(0);
    expect(kpis.participations.value).toBeGreaterThan(0);
    expect(kpis.averageRate.value).toBeGreaterThan(0);
    expect(kpis.averageRate.value).toBeLessThanOrEqual(100);
    expect(kpis.enps).not.toBeNull();
    expect(kpis.enps!.value).toBeGreaterThanOrEqual(-100);
    expect(kpis.enps!.value).toBeLessThanOrEqual(100);

    // Quem não lê resultados da empresa toda não recebe eNPS.
    const carla = await session("carla");
    expect((await getSurveyKpis(carla.actor)).enps).toBeNull();
  });

  it("eNPS = % promotores (9–10) − % detratores (0–6)", () => {
    expect(enpsFromDistribution({ "10": 5, "9": 1, "8": 2, "6": 1, "3": 1 })).toBe(40);
    expect(enpsFromDistribution({})).toBeNull();
  });

  it("agendada: colaborador não vê nem responde; o cofre recusa antes do início", async () => {
    const tenant = await tenantOf("aurora");
    const [scheduled] = await rowsOf<{ id: string }>(sql`select id from surveys where tenant_id = ${tenant.tenantId} and title = 'eNPS — 2º semestre de 2026'`);
    const camila = await session("camila");
    expect((await listMySurveys(camila.actor)).some((m) => m.id === scheduled!.id)).toBe(false);
    await expect(getSurveyToAnswer(camila.actor, scheduled!.id)).rejects.toMatchObject({ status: 404 });
    const [question] = await rowsOf<{ id: string }>(sql`select id from survey_questions where survey_id = ${scheduled!.id} order by position limit 1`);
    const res = await call(submitRoute.POST, { path: "/x", method: "POST", cookie: camila.cookie, params: { id: scheduled!.id }, body: { answers: { [question!.id]: 9 } } });
    expect(res.status).toBe(404);
    // Direto no banco, como a aplicação: o cofre também recusa.
    await expectDbError(
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${tenant.tenantId}, true)`);
        await db.execute(sql`select survey_vault.submit(${scheduled!.id}::uuid, '{}'::jsonb, '{}'::jsonb)`);
      }),
      /pesquisa indisponível/,
    );
  });

  it("lança agendada para uma área: só a área é convidada e o público congela", async () => {
    const { big } = await areas();
    const { id, admin } = await draft("Pulso de teste: área agendada");
    const size = await call(audienceRoute.GET, { path: `/api/v1/surveys/audience?orgUnitId=${big.id}`, cookie: admin.cookie });
    expect(size.json.size).toBe(big.n);

    // Encerramento antes do início → 400.
    expect((await call(launchRoute.POST, { path: "/x", method: "POST", cookie: admin.cookie, params: { id }, body: { opensAt: iso(10), closesAt: iso(5), audienceOrgUnitId: big.id } })).status).toBe(400);

    const launched = await call(launchRoute.POST, { path: "/x", method: "POST", cookie: admin.cookie, params: { id }, body: { opensAt: iso(10), closesAt: iso(20), audienceOrgUnitId: big.id } });
    expect(launched.status).toBe(200);
    expect(launched.json).toMatchObject({ invited: big.n, scheduled: true });
    const [{ invited }] = await rowsOf<{ invited: number }>(sql`select count(*)::int as invited from survey_invitations where survey_id = ${id}`);
    expect(invited).toBe(big.n);

    const { actor } = await session("paula");
    const row = (await listSurveyDirectory(actor, query({ search: "área agendada" }))).items[0]!;
    expect(row).toMatchObject({ displayStatus: "scheduled", audienceOrgUnitId: big.id, audienceSize: big.n });

    // Público congelado depois do lançamento (garantido no banco).
    const tenant = await tenantOf("aurora");
    await expectDbError(
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${tenant.tenantId}, true)`);
        await db.execute(sql`update surveys set audience_org_unit_id = null where id = ${id}`);
      }),
      /público congela/,
    );
  });

  it("público abaixo do k é recusado; gestora não consulta público nem lança", async () => {
    const { small } = await areas();
    const { id, admin } = await draft("Pulso de teste: área pequena");
    if (small.n < 5) {
      expect((await call(launchRoute.POST, { path: "/x", method: "POST", cookie: admin.cookie, params: { id }, body: { closesAt: iso(7), audienceOrgUnitId: small.id } })).status).toBe(409);
    }
    const carla = await session("carla");
    expect((await call(audienceRoute.GET, { path: "/api/v1/surveys/audience", cookie: carla.cookie })).status).toBe(403);
  });

  it("exporta só participação (nunca respostas), filtrada ou selecionada, com auditoria", async () => {
    const paula = await session("paula");
    const exportCsv = async (cookie: string, qs: string) => exportRoute.GET(new Request(`http://localhost:3000/api/v1/surveys/export?${qs}`, { headers: { cookie, "x-forwarded-for": "203.0.113.50" } }), { params: Promise.resolve({}) });

    const all = await exportCsv(paula.cookie, "status=encerradas");
    expect(all.status).toBe(200);
    const text = await all.text();
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toContain("Pesquisa;Tipo;Público");
    expect(lines.slice(1).every((l) => l.includes("Encerrada"))).toBe(true);
    // Nenhum comentário de resposta vaza (o seed usa estes textos nos comentários).
    expect(text).not.toMatch(/Mais momentos de integração|rituais de feedback|clareza nas prioridades/i);

    const tenant = await tenantOf("aurora");
    const [one] = await rowsOf<{ id: string }>(sql`select id from surveys where tenant_id = ${tenant.tenantId} and title = 'Pesquisa de Clima 2026'`);
    const selected = await exportCsv(paula.cookie, `ids=${one!.id}`);
    expect((await selected.text()).trim().split("\r\n")).toHaveLength(2);
    const [audit] = await rowsOf<{ metadata: { report: string; rows: number; selection: boolean } }>(
      sql`select metadata from audit_logs where action = 'data.exported' and metadata->>'report' = 'surveys' order by created_at desc limit 1`,
    );
    expect(audit!.metadata).toMatchObject({ rows: 1, selection: true });

    const carla = await session("carla");
    expect((await exportCsv(carla.cookie, "")).status).toBe(403);
  });

  it("a lista da gestão não mostra rascunhos para quem só lê resultados", async () => {
    const tenant = await tenantOf("aurora");
    const drafts = await rowsOf<{ n: number }>(sql`select count(*)::int as n from surveys where tenant_id = ${tenant.tenantId} and status = 'draft'`);
    expect(drafts[0]!.n).toBeGreaterThan(0);
    const { db } = await testDatabase();
    const [row] = await db.select({ id: s.surveys.id }).from(s.surveys).where(and(eq(s.surveys.tenantId, tenant.tenantId), eq(s.surveys.status, "draft"))).limit(1);
    expect(row).toBeTruthy();
    const carla = await session("carla");
    const list = await listSurveyDirectory(carla.actor, query());
    expect(list.items.some((r) => r.displayStatus === "draft")).toBe(false);
  });
});
