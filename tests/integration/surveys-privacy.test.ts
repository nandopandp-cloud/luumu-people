import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as submitRoute from "@/app/api/v1/me/surveys/[id]/responses/route";
import * as audienceRoute from "@/app/api/v1/surveys/audience/route";
import * as launchRoute from "@/app/api/v1/surveys/[id]/launch/route";
import * as resultsRoute from "@/app/api/v1/surveys/[id]/results/route";
import * as surveyRoute from "@/app/api/v1/surveys/[id]/route";
import * as surveysRoute from "@/app/api/v1/surveys/route";
import { resolveActor } from "@/server/auth/session";
import { getSurveyResults, getSurveyToAnswer } from "@/server/modules/surveys/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

/**
 * Privacidade escolhida por quem cria (anônima × identificada), pesquisa LIVRE
 * (sem mínimo) e público com várias áreas (docs/anonymous-surveys.md).
 */

type Row = Record<string, unknown>;
const rowsOf = async <T extends Row>(statement: ReturnType<typeof sql>) => ((await (await testDatabase()).db.execute(statement)) as unknown as { rows: T[] }).rows;
const iso = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function session(key: string) {
  const s1 = await signIn("aurora", key);
  return { ...s1, actor: (await resolveActor(headersWith(s1.cookie)))! };
}

/** Áreas-folha com gente ativa e as pessoas de cada uma (da maior para a menor). */
async function leafAreas() {
  const tenant = await tenantOf("aurora");
  return rowsOf<{ id: string; n: number; members: string[] }>(sql`
    select ou.id, count(*)::int as n, coalesce(json_agg(u.id), '[]'::json) as members from org_units ou
    join employment_assignments ea on ea.org_unit_id = ou.id and ea.valid_to is null
    join users u on u.id = ea.user_id and u.status = 'active'
    where ou.tenant_id = ${tenant.tenantId} and ou.type = 'area' and not exists (select 1 from org_units c where c.parent_id = ou.id)
    group by ou.id order by n desc`);
}

async function keyOf(userId: string) {
  const tenant = await tenantOf("aurora");
  for (const [key, user] of tenant.users) if (user.id === userId) return key;
  throw new Error("pessoa não semeada");
}

async function draft(body: Record<string, unknown>) {
  const admin = await session("juliana");
  const created = await call(surveysRoute.POST, {
    path: "/api/v1/surveys",
    method: "POST",
    cookie: admin.cookie,
    body: { kind: "custom", questions: [{ type: "scale", text: "Gostei do formato." }, { type: "text", text: "Sugestões", required: false }], ...body },
  });
  expect(created.status).toBe(200);
  const id = created.json.id as string;
  const questions = await rowsOf<{ id: string }>(sql`select id from survey_questions where survey_id = ${id} order by position`);
  return { id, scaleId: questions[0]!.id, textId: questions[1]!.id, admin };
}

const launch = (cookie: string, id: string, body: Record<string, unknown>) => call(launchRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: { closesAt: iso(7), ...body } });

async function answer(key: string, id: string, answers: Record<string, number | string>) {
  const { cookie } = await signIn("aurora", key);
  return call(submitRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: { answers } });
}

describe("pesquisas: privacidade, pesquisa livre e público por áreas", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("público com várias áreas: convida a união e conta certo no diálogo", async () => {
    const [a, b] = await leafAreas();
    const { id, admin } = await draft({ title: "Pulso: duas áreas" });
    const size = await call(audienceRoute.GET, { path: `/api/v1/surveys/audience?orgUnitIds=${a!.id},${b!.id}`, cookie: admin.cookie });
    expect(size.status).toBe(200);
    expect(size.json.size).toBe(a!.n + b!.n);
    expect((await launch(admin.cookie, id, { audienceOrgUnitIds: [a!.id, b!.id, a!.id] })).status).toBe(200);
    const invited = await rowsOf<{ user_id: string }>(sql`select user_id from survey_invitations where survey_id = ${id}`);
    expect(new Set(invited.map((r) => r.user_id))).toEqual(new Set([...a!.members, ...b!.members]));
    const units = await rowsOf<{ org_unit_id: string }>(sql`select org_unit_id from survey_audience_units where survey_id = ${id}`);
    expect(units.map((u) => u.org_unit_id).sort()).toEqual([a!.id, b!.id].sort());
    // Área de outra empresa (ou inexistente) → 400.
    const other = await draft({ title: "Pulso: área estranha" });
    expect((await launch(other.admin.cookie, other.id, { audienceOrgUnitIds: ["00000000-0000-4000-8000-000000000000"] })).status).toBe(400);
  });

  it("anônima LIVRE: lança para menos de k pessoas, libera desde a 1ª resposta e não tem recortes", async () => {
    const small = (await leafAreas()).at(-1)!;
    const { id, scaleId, admin } = await draft({ title: "Pulso livre: área pequena", noMinimum: true });
    // A mesma área numa pesquisa COM mínimo seria recusada (se for menor que k).
    if (small.n < 5) {
      const withK = await draft({ title: "Pulso com k: área pequena" });
      expect((await launch(admin.cookie, withK.id, { audienceOrgUnitIds: [small.id] })).status).toBe(409);
    }
    const launched = await launch(admin.cookie, id, { audienceOrgUnitIds: [small.id] });
    expect(launched.status).toBe(200);
    expect(launched.json).toMatchObject({ invited: small.n, k: null });
    const [survey] = await rowsOf<{ dimensions: object; no_minimum: boolean; anonymity_mode: string }>(sql`select dimensions, no_minimum, anonymity_mode from surveys where id = ${id}`);
    expect(survey).toMatchObject({ dimensions: {}, no_minimum: true, anonymity_mode: "anonymous" });

    const respondent = await keyOf(small.members[0]!);
    const form = await getSurveyToAnswer((await session(respondent)).actor, id);
    expect(form.survey).toMatchObject({ anonymityMode: "anonymous", noMinimum: true });
    expect((await answer(respondent, id, { [scaleId]: 4 })).status).toBe(204);

    const paula = await session("paula");
    const data = await getSurveyResults(paula.actor, id);
    expect(data.results).toMatchObject({ suppressed: false, responses: 1 });
    expect(data.individual).toBeNull();
    expect(data.dimensions).toEqual([]);
    // O cofre continua sem identidade: nenhuma resposta anônima vai para a tabela identificada.
    expect(await rowsOf(sql`select 1 from survey_identified_responses where survey_id = ${id}`)).toHaveLength(0);
    // Sem dimensões aprovadas, o cofre recusa recortes.
    const tenant = await tenantOf("aurora");
    await expectDbError(
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${tenant.tenantId}, true)`);
        await db.execute(sql`select survey_vault.breakdown(${id}::uuid, 'area')`);
      }),
      /não aprovada/,
    );
  });

  it("IDENTIFICADA: é sempre livre, grava a resposta com a pessoa e só G&G lê", async () => {
    const small = (await leafAreas()).at(-1)!;
    const { id, scaleId, textId, admin } = await draft({ title: "Feedback identificado", anonymityMode: "identified", noMinimum: false });
    const [stored] = await rowsOf<{ no_minimum: boolean; anonymity_mode: string }>(sql`select no_minimum, anonymity_mode from surveys where id = ${id}`);
    expect(stored).toMatchObject({ anonymity_mode: "identified", no_minimum: true });
    expect((await launch(admin.cookie, id, { audienceOrgUnitIds: [small.id] })).status).toBe(200);

    const respondentId = small.members[0]!;
    const respondent = await keyOf(respondentId);
    expect((await answer(respondent, id, { [scaleId]: 5, [textId]: "Texto com nome" })).status).toBe(204);
    expect((await answer(respondent, id, { [scaleId]: 1 })).status).toBe(409);
    const stored2 = await rowsOf<{ user_id: string; answers: Record<string, unknown> }>(sql`select user_id, answers from survey_identified_responses where survey_id = ${id}`);
    expect(stored2).toEqual([{ user_id: respondentId, answers: { [scaleId]: 5, [textId]: "Texto com nome" } }]);
    // Identificada nunca passa pelo cofre.
    const tenant = await tenantOf("aurora");
    await expectDbError(
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${tenant.tenantId}, true)`);
        await db.execute(sql`select survey_vault.submit(${id}::uuid, '{}'::jsonb, '{}'::jsonb)`);
      }),
      /pesquisa indisponível/,
    );

    // G&G vê o agregado e a resposta com o nome.
    const paula = await session("paula");
    const data = await getSurveyResults(paula.actor, id);
    expect(data.results).toMatchObject({ suppressed: false, responses: 1 });
    expect(data.individual).toHaveLength(1);
    expect(data.individual![0]).toMatchObject({ userId: respondentId, answers: { [scaleId]: 5 } });
    // Gestora (resultados só da equipe) e colaborador: 403 na API.
    const carla = await session("carla");
    expect((await call(resultsRoute.GET, { path: "/x", cookie: carla.cookie, params: { id } })).status).toBe(403);
    const fernando = await session("fernando");
    expect((await call(resultsRoute.GET, { path: "/x", cookie: fernando.cookie, params: { id } })).status).toBe(403);
  });

  it("banco: ninguém responde por outra pessoa, nem altera ou apaga resposta identificada", async () => {
    // Área pequena com ao menos 2 pessoas e sem a administradora (que fica fora do público).
    const outsider = (await tenantOf("aurora")).users.get("juliana")!.id;
    const small = (await leafAreas()).filter((a) => a.n >= 2 && !a.members.includes(outsider)).at(-1)!;
    const { id, scaleId, admin } = await draft({ title: "Identificada: travas", anonymityMode: "identified" });
    expect((await launch(admin.cookie, id, { audienceOrgUnitIds: [small.id] })).status).toBe(200);
    const tenant = await tenantOf("aurora");
    const [someone, other] = small.members;
    const asUser = (userId: string, statement: ReturnType<typeof sql>) =>
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${tenant.tenantId}, true)`);
        await db.execute(sql`select set_config('app.user_id', ${userId}, true)`);
        await db.execute(statement);
      });
    const insert = (userId: string) => sql`insert into survey_identified_responses (tenant_id, survey_id, user_id, answers) values (${tenant.tenantId}, ${id}, ${userId}, ${JSON.stringify({ [scaleId]: 3 })}::jsonb)`;
    await expectDbError(asUser(someone!, insert(other!)), /row-level security/);
    // Fora do público (sem convite) → recusado pelo trigger.
    await expectDbError(asUser(outsider, insert(outsider)), /fora do público/);
    expect((await answer(await keyOf(someone!), id, { [scaleId]: 3 })).status).toBe(204);
    await expectDbError(asUser(someone!, sql`update survey_identified_responses set answers = '{}' where survey_id = ${id}`), /permission denied/);
    await expectDbError(asUser(someone!, sql`delete from survey_identified_responses where survey_id = ${id}`), /permission denied/);
  });

  it("rascunho troca a privacidade; excluir a identificada lançada apaga as respostas junto", async () => {
    const small = (await leafAreas()).at(-1)!;
    const { id, scaleId, admin } = await draft({ title: "Privacidade editável" });
    const put = await call(surveyRoute.PUT, {
      path: "/x",
      method: "PUT",
      cookie: admin.cookie,
      params: { id },
      body: { title: "Privacidade editável", kind: "custom", anonymityMode: "identified", questions: [{ type: "scale", text: "Gostei do formato." }] },
    });
    expect(put.status).toBe(200);
    const [row] = await rowsOf<{ anonymity_mode: string; no_minimum: boolean }>(sql`select anonymity_mode, no_minimum from surveys where id = ${id}`);
    expect(row).toMatchObject({ anonymity_mode: "identified", no_minimum: true });
    expect((await launch(admin.cookie, id, { audienceOrgUnitIds: [small.id] })).status).toBe(200);
    const [question] = await rowsOf<{ id: string }>(sql`select id from survey_questions where survey_id = ${id}`);
    expect(question!.id).not.toBe(scaleId);
    expect((await answer(await keyOf(small.members[0]!), id, { [question!.id]: 4 })).status).toBe(204);
    expect((await call(surveyRoute.DELETE, { path: "/x", method: "DELETE", cookie: admin.cookie, params: { id } })).status).toBe(204);
    expect(await rowsOf(sql`select 1 from survey_identified_responses where survey_id = ${id}`)).toHaveLength(0);
    expect(await rowsOf(sql`select 1 from survey_audience_units where survey_id = ${id}`)).toHaveLength(0);
  });
});
