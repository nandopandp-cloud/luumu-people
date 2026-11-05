import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as personRoute from "@/app/api/v1/people/[id]/route";
import { resolveActor } from "@/server/auth/session";
import { getPerson } from "@/server/modules/people/service";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

/** Edição dos dados do colaborador pela gestão (people.manage): PATCH /api/v1/people/:id. */

type Row = Record<string, unknown>;
const rowsOf = async <T extends Row>(statement: ReturnType<typeof sql>) => ((await (await testDatabase()).db.execute(statement)) as unknown as { rows: T[] }).rows;

async function session(key: string) {
  const s1 = await signIn("aurora", key);
  return { ...s1, actor: (await resolveActor(headersWith(s1.cookie)))! };
}

const patch = (cookie: string, id: string, body: unknown) => call(personRoute.PATCH, { path: "/x", method: "PATCH", cookie, params: { id }, body });

async function orgUnitId(name: string) {
  const tenant = await tenantOf("aurora");
  const [row] = await rowsOf<{ id: string }>(sql`select id from org_units where tenant_id = ${tenant.tenantId} and name = ${name}`);
  return row!.id;
}

describe("colaboradores: edição dos dados pela gestão", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("só quem administra pessoas edita; outra empresa → 404; corpo vazio ou com campos extras → 400", async () => {
    const otavio = await userOf("aurora", "otavio");
    const carla = await session("carla");
    expect((await patch(carla.cookie, otavio.id, { phone: "+55 21 99999-0000" })).status).toBe(403);
    const fernando = await session("fernando");
    expect((await patch(fernando.cookie, otavio.id, { phone: "+55 21 99999-0000" })).status).toBe(403);
    const juliana = await session("juliana");
    const foreign = await userOf("horizonte", "sergio");
    expect((await patch(juliana.cookie, foreign.id, { phone: "+55 31 99999-0000" })).status).toBe(404);
    expect((await patch(juliana.cookie, otavio.id, {})).status).toBe(400);
    expect((await patch(juliana.cookie, otavio.id, { tenantId: foreign.tenantId, role: "admin" })).status).toBe(400);
  });

  it("G&G edita nome, data de entrada, contrato, vínculo, matrícula e telefone; auditoria só com os nomes dos campos", async () => {
    const juliana = await session("juliana");
    const otavio = await userOf("aurora", "otavio");
    const res = await patch(juliana.cookie, otavio.id, {
      name: "Otávio Ferraz Lima",
      hireDate: "2021-10-01",
      contractType: "pj",
      employmentStatus: "on_leave",
      employeeCode: "FIN-0042",
      phone: "+55 21 98888-7777",
      preferredName: "Tavinho",
    });
    expect(res.status).toBe(200);
    expect([...res.json.fields].sort()).toEqual(["contractType", "employeeCode", "employmentStatus", "hireDate", "name", "phone", "preferredName"]);
    const person = await getPerson(juliana.actor, otavio.id);
    expect(person).toMatchObject({ name: "Otávio Ferraz Lima", hireDate: "2021-10-01", preferredName: "Tavinho" });
    expect(person.personal).toMatchObject({ contractType: "pj", employmentStatus: "on_leave", employeeCode: "FIN-0042", phone: "+55 21 98888-7777" });
    const [audit] = await rowsOf<{ metadata: Record<string, unknown> }>(sql`select metadata from audit_logs where action = 'people.updated' and resource_id = ${otavio.id} order by created_at desc limit 1`);
    expect(audit!.metadata).toEqual({ fields: res.json.fields });
    expect(JSON.stringify(audit!.metadata)).not.toContain("98888");

    // Matrícula repetida → 409.
    const simone = await userOf("aurora", "simone");
    expect((await patch(juliana.cookie, simone.id, { employeeCode: "FIN-0042" })).status).toBe(409);
  });

  it("área, cargo, nível e localização geram histórico (inclusive duas mudanças no mesmo dia)", async () => {
    const juliana = await session("juliana");
    const caio = await userOf("aurora", "caio");
    const count = async () => (await rowsOf<{ n: number }>(sql`select count(*)::int as n from employment_assignments where user_id = ${caio.id}`))[0]!.n;
    const before = await count();

    const juridico = await orgUnitId("Jurídico");
    expect((await patch(juliana.cookie, caio.id, { orgUnitId: juridico, position: "Analista", jobLevel: "Pleno" })).status).toBe(200);
    // Segunda correção no mesmo dia: o registro de hoje fica com vigência vazia (nunca vale) e o novo vale.
    expect((await patch(juliana.cookie, caio.id, { location: { city: "Campinas", state: "sp" } })).status).toBe(200);
    expect(await count()).toBe(before + 2);
    const current = await rowsOf<{ org_unit_id: string; reason: string; business_unit_id: string }>(
      sql`select org_unit_id, reason, business_unit_id from employment_assignments where user_id = ${caio.id} and valid_to is null`,
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ org_unit_id: juridico, reason: "correction" });
    const person = await getPerson(juliana.actor, caio.id);
    expect(person).toMatchObject({ orgUnit: "Jurídico", position: "Analista", level: "Pleno", city: "Campinas", state: "SP" });
    const [transfer] = await rowsOf<{ metadata: { to: string } }>(sql`select metadata from audit_logs where action = 'people.transferred' and resource_id = ${caio.id} order by created_at desc limit 1`);
    expect(transfer!.metadata.to).toBe(juridico);

    // A mesma cidade reaproveita a localização; null remove.
    const luiza = await userOf("aurora", "luiza");
    expect((await patch(juliana.cookie, luiza.id, { location: { city: "campinas", state: "SP" } })).status).toBe(200);
    const units = await rowsOf<{ business_unit_id: string }>(sql`select business_unit_id from employment_assignments where user_id in (${caio.id}, ${luiza.id}) and valid_to is null`);
    expect(new Set(units.map((u) => u.business_unit_id)).size).toBe(1);
    expect((await patch(juliana.cookie, luiza.id, { location: null })).status).toBe(200);
    expect((await getPerson(juliana.actor, luiza.id)).city).toBeNull();
  });

  it("gestor(a): precisa ter o papel Gestor, não pode ser a própria pessoa nem alguém da equipe dela", async () => {
    const juliana = await session("juliana");
    const [fernando, carla, ricardo, camila] = await Promise.all(["fernando", "carla", "ricardo", "camila"].map((k) => userOf("aurora", k)));
    expect((await patch(juliana.cookie, fernando.id, { managerId: camila!.id })).status).toBe(400);
    expect((await patch(juliana.cookie, carla!.id, { managerId: carla!.id })).status).toBe(400);
    // Ricardo gere Carla: Carla não pode passar a gerir Ricardo (ciclo).
    expect((await patch(juliana.cookie, ricardo!.id, { managerId: carla!.id })).status).toBe(400);
    expect((await patch(juliana.cookie, fernando!.id, { managerId: ricardo!.id })).status).toBe(200);
    expect((await getPerson(juliana.actor, fernando!.id)).managerId).toBe(ricardo!.id);
    expect((await patch(juliana.cookie, fernando!.id, { managerId: null })).status).toBe(200);
    expect((await getPerson(juliana.actor, fernando!.id)).managerId).toBeNull();
    expect((await patch(juliana.cookie, fernando!.id, { managerId: carla!.id })).status).toBe(200);
  });

  it("e-mail: só quem tem todos os acessos da pessoa troca; nunca o próprio; a troca encerra as sessões", async () => {
    const juliana = await session("juliana");
    const paula = await session("paula");
    // G&G não troca o e-mail da administradora (recuperaria uma conta com mais acesso).
    expect((await patch(juliana.cookie, paula.actor.userId, { email: "paula.nova@aurora.example" })).status).toBe(403);
    // Nem o próprio.
    expect((await patch(paula.cookie, paula.actor.userId, { email: "paula.nova@aurora.example" })).status).toBe(403);
    // E-mail já em uso na plataforma → 409.
    const sergio = await userOf("horizonte", "sergio");
    expect((await patch(paula.cookie, juliana.actor.userId, { email: sergio.email })).status).toBe(409);

    expect((await patch(paula.cookie, juliana.actor.userId, { email: "Juliana.Nova@aurora.example" })).status).toBe(200);
    const [row] = await rowsOf<{ email: string }>(sql`select email from users where id = ${juliana.actor.userId}`);
    expect(row!.email).toBe("juliana.nova@aurora.example");
    expect(await resolveActor(headersWith(juliana.cookie))).toBeNull();
  });
});
