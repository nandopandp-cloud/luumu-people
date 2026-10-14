import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as inviteRoute from "@/app/api/v1/people/[id]/invite/route";
import * as statusRoute from "@/app/api/v1/people/[id]/status/route";
import * as exportRoute from "@/app/api/v1/people/export/route";
import * as peopleRoute from "@/app/api/v1/people/route";
import { getAuth } from "@/server/auth/auth";
import { resolveActor } from "@/server/auth/session";
import { listDirectory } from "@/server/modules/people/directory";
import { directoryQuerySchema } from "@/server/modules/people/schemas";
import { headersWith, signIn } from "../support/auth";
import { tenantOf, testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

// Captura os e-mails (em teste o envio é descartado) para ler o link do convite.
const sent = vi.hoisted(() => [] as { to: string; subject: string; text: string; html: string }[]);
vi.mock("@/server/email/mailer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/email/mailer")>()),
  sendEmail: async (message: { to: string; subject: string; text: string; html: string }) => {
    sent.push(message);
  },
}));

async function actorOf(key: string) {
  const session = await signIn("aurora", key);
  return { session, actor: (await resolveActor(headersWith(session.cookie)))! };
}

const query = (input: Record<string, unknown> = {}) => directoryQuerySchema.parse(input);

async function statusOf(userId: string) {
  const { db } = await testDatabase();
  const result = (await db.execute(sql`select status from users where id = ${userId}`)) as unknown as { rows: { status: string }[] };
  return result.rows[0]?.status;
}

async function lastAudit(action: string, resourceId: string) {
  const { db } = await testDatabase();
  const result = (await db.execute(sql`select actor_user_id as "actorUserId", metadata from audit_logs where action = ${action} and resource_id = ${resourceId} order by created_at desc limit 1`)) as unknown as {
    rows: { actorUserId: string; metadata: Record<string, unknown> }[];
  };
  return result.rows[0];
}

describe("colaboradores: diretório, cadastro e convite", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("diretório: paginação numerada, contagens por situação, busca por cargo e ordenação", async () => {
    const { actor } = await actorOf("paula");
    const page = await listDirectory(actor, query({ perPage: 10 }));
    expect(page.items).toHaveLength(10);
    expect(page.counts.all).toBe(page.counts.active + page.counts.inactive + page.counts.invited);
    expect(page.total).toBe(page.counts.all);
    expect(page.lastAccess).toBe(true);

    const second = await listDirectory(actor, query({ perPage: 10, page: 2 }));
    expect(second.items[0]!.name >= page.items.at(-1)!.name).toBe(true);

    const analysts = await listDirectory(actor, query({ search: "analista", perPage: 50 }));
    expect(analysts.items.length).toBeGreaterThan(0);
    expect(analysts.items.every((p) => /analista/i.test(`${p.position} ${p.name} ${p.email} ${p.orgUnit}`))).toBe(true);

    const byPosition = await listDirectory(actor, query({ sort: "position", dir: "desc", perPage: 50 }));
    const positions = byPosition.items.map((p) => p.position).filter((p): p is string => p !== null);
    // Mesma ordem do banco (colação binária), decrescente.
    expect(positions.every((p, i) => i === 0 || positions[i - 1]! >= p)).toBe(true);
  });

  it("gestora vê só a equipe, sem último acesso nem filtro de vínculo (dado de RH)", async () => {
    const { actor } = await actorOf("carla");
    const page = await listDirectory(actor, query({ perPage: 50 }));
    expect(page.lastAccess).toBe(false);
    expect(page.items.every((p) => p.lastAccessAt === null)).toBe(true);
    expect(page.items.map((p) => p.name)).not.toContain("João Silva");
    await expect(listDirectory(actor, query({ employmentStatus: "on_leave" }))).rejects.toMatchObject({ status: 403 });
  });

  it("cadastra como convidado(a), envia o convite e ativa quando a pessoa cria a senha", async () => {
    const { session } = await actorOf("paula");
    const org = await tenantOf("aurora");
    const carla = await userOf("aurora", "carla");
    const { db } = await testDatabase();
    const ids = (await db.execute(sql`select (select id from org_units where tenant_id = ${org.tenantId} limit 1) as unit, (select id from positions where tenant_id = ${org.tenantId} limit 1) as position`)) as unknown as {
      rows: { unit: string; position: string }[];
    };
    const { unit, position } = ids.rows[0]!;
    const body = { name: "Bianca Teixeira", email: "bianca.teixeira@aurora.example", hireDate: "2026-10-13", orgUnitId: unit, positionId: position, managerId: carla.id };

    const res = await call(peopleRoute.POST, { path: "/api/v1/people", method: "POST", cookie: session.cookie, body });
    expect(res.status).toBe(201);
    expect(res.json.invited).toBe(true);
    const id = res.json.id as string;
    expect(await statusOf(id)).toBe("invited");
    expect(await lastAudit("people.created", id)).toBeTruthy();
    expect(await lastAudit("people.invited", id)).toBeTruthy();

    // E-mail com o link de uso único (7 dias), sem dados além do necessário.
    const mail = sent.findLast((m) => m.to === body.email)!;
    expect(mail.subject).toContain("convidou você");
    const token = /convite\?token=([\w-]+)/.exec(mail.text)?.[1];
    expect(token).toBeTruthy();
    expect(mail.html).toContain("Ativar minha conta");

    // Lotação, gestora e papel base.
    const created = (await listDirectory((await actorOf("paula")).actor, query({ search: "Bianca" }))).items[0]!;
    expect(created).toMatchObject({ status: "invited", managerName: "Carla Mendes", orgUnitId: unit });
    const roles = (await db.execute(sql`select r.key from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = ${id}`)) as unknown as { rows: { key: string }[] };
    expect(roles.rows.map((r) => r.key)).toEqual(["employee"]);

    // Convidada ainda não entra.
    const auth = await getAuth();
    const before = await auth.api.signInEmail({ body: { email: body.email, password: "SenhaDaBianca#2026" }, asResponse: true });
    expect(before.status).not.toBe(200);

    // Cria a senha pelo convite → ativa e consegue entrar; o link não serve duas vezes.
    await auth.api.resetPassword({ body: { newPassword: "SenhaDaBianca#2026", token: token! } });
    expect(await statusOf(id)).toBe("active");
    expect(await lastAudit("people.activated", id)).toBeTruthy();
    const after = await auth.api.signInEmail({ body: { email: body.email, password: "SenhaDaBianca#2026" }, headers: new Headers({ "x-forwarded-for": "203.0.113.30" }), asResponse: true });
    expect(after.status).toBe(200);
    await expect(auth.api.resetPassword({ body: { newPassword: "OutraSenha#20266", token: token! } })).rejects.toBeTruthy();

    // E-mail repetido (único na plataforma) → 409.
    expect((await call(peopleRoute.POST, { path: "/api/v1/people", method: "POST", cookie: session.cookie, body })).status).toBe(409);
    // Reenviar convite para quem já ativou → 409.
    expect((await call(inviteRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, params: { id } })).status).toBe(409);
  });

  it("só quem administra pessoas cadastra; gestor(a) inativo(a) é recusado(a)", async () => {
    const carla = await actorOf("carla");
    const org = await tenantOf("aurora");
    const { db } = await testDatabase();
    const ids = (await db.execute(sql`select (select id from org_units where tenant_id = ${org.tenantId} limit 1) as unit, (select id from positions where tenant_id = ${org.tenantId} limit 1) as position`)) as unknown as {
      rows: { unit: string; position: string }[];
    };
    const body = { name: "Pessoa Teste", email: "pessoa.teste@aurora.example", hireDate: "2026-10-13", orgUnitId: ids.rows[0]!.unit, positionId: ids.rows[0]!.position };
    expect((await call(peopleRoute.POST, { path: "/api/v1/people", method: "POST", cookie: carla.session.cookie, body })).status).toBe(403);
    // Campos fora do contrato (papel, empresa, status) → 400.
    const paula = await actorOf("paula");
    expect((await call(peopleRoute.POST, { path: "/api/v1/people", method: "POST", cookie: paula.session.cookie, body: { ...body, status: "active" } })).status).toBe(400);
  });

  it("desativa na hora, reativa conforme o histórico e nunca o próprio acesso", async () => {
    const paula = await actorOf("paula");
    const gabriel = await actorOf("gabriel");
    const path = "/x";

    expect((await call(statusRoute.POST, { path, method: "POST", cookie: paula.session.cookie, params: { id: gabriel.actor.userId }, body: { status: "inactive" } })).status).toBe(200);
    expect(await statusOf(gabriel.actor.userId)).toBe("inactive");
    // A sessão aberta deixa de valer imediatamente.
    expect(await resolveActor(headersWith(gabriel.session.cookie))).toBeNull();
    expect((await lastAudit("people.deactivated", gabriel.actor.userId))?.actorUserId).toBe(paula.actor.userId);

    // Já acessou antes → volta a "ativo".
    const back = await call(statusRoute.POST, { path, method: "POST", cookie: paula.session.cookie, params: { id: gabriel.actor.userId }, body: { status: "active" } });
    expect(back.json.status).toBe("active");

    // O próprio acesso, não.
    expect((await call(statusRoute.POST, { path, method: "POST", cookie: paula.session.cookie, params: { id: paula.actor.userId }, body: { status: "inactive" } })).status).toBe(400);
    // Gestora não administra acessos.
    const carla = await actorOf("carla");
    expect((await call(statusRoute.POST, { path, method: "POST", cookie: carla.session.cookie, params: { id: gabriel.actor.userId }, body: { status: "inactive" } })).status).toBe(403);
  });

  it("convite cancelado e reativado volta a pendente (sem acesso sem criar a senha)", async () => {
    const paula = await actorOf("paula");
    const org = await tenantOf("aurora");
    const { db } = await testDatabase();
    const ids = (await db.execute(sql`select (select id from org_units where tenant_id = ${org.tenantId} limit 1) as unit, (select id from positions where tenant_id = ${org.tenantId} limit 1) as position`)) as unknown as {
      rows: { unit: string; position: string }[];
    };
    const created = await call(peopleRoute.POST, {
      path: "/api/v1/people",
      method: "POST",
      cookie: paula.session.cookie,
      body: { name: "Davi Nunes", email: "davi.nunes@aurora.example", hireDate: "2026-10-14", orgUnitId: ids.rows[0]!.unit, positionId: ids.rows[0]!.position, sendInvite: false },
    });
    expect(created.json.invited).toBe(false);
    const id = created.json.id as string;
    expect((await call(inviteRoute.POST, { path: "/x", method: "POST", cookie: paula.session.cookie, params: { id } })).json).toEqual({ invited: true });
    await call(statusRoute.POST, { path: "/x", method: "POST", cookie: paula.session.cookie, params: { id }, body: { status: "inactive" } });
    expect(await statusOf(id)).toBe("inactive");
    const back = await call(statusRoute.POST, { path: "/x", method: "POST", cookie: paula.session.cookie, params: { id }, body: { status: "active" } });
    expect(back.json.status).toBe("invited");
  });

  it("exporta o diretório filtrado ou a seleção em CSV, com auditoria; gestora sem exportação não exporta", async () => {
    const paula = await actorOf("paula");
    const exportCsv = async (cookie: string, qs: string) => exportRoute.GET(new Request(`http://localhost:3000/api/v1/people/export?${qs}`, { headers: { cookie, "x-forwarded-for": "203.0.113.40" } }), { params: Promise.resolve({}) });

    const all = await exportCsv(paula.session.cookie, "status=active");
    expect(all.status).toBe(200);
    expect(all.headers.get("content-type")).toContain("text/csv");
    const lines = (await all.text()).trim().split("\r\n");
    expect(lines[0]).toContain("Nome;E-mail;Cargo");
    expect(lines[0]).toContain("Último acesso");
    expect(lines.length).toBeGreaterThan(5);

    const fernando = await userOf("aurora", "fernando");
    const selection = await exportCsv(paula.session.cookie, `ids=${fernando.id}`);
    expect((await selection.text()).trim().split("\r\n")).toHaveLength(2);
    const { db } = await testDatabase();
    const audits = (await db.execute(sql`select metadata from audit_logs where action = 'data.exported' and metadata->>'report' = 'people' order by created_at desc limit 1`)) as unknown as { rows: { metadata: { rows: number; selection: boolean } }[] };
    expect(audits.rows[0]!.metadata).toMatchObject({ rows: 1, selection: true });

    const carla = await actorOf("carla");
    expect((await exportCsv(carla.session.cookie, "")).status).toBe(403);
  });
});
