import { beforeAll, describe, expect, it } from "vitest";
import * as actionRoute from "@/app/api/v1/development/actions/[actionId]/route";
import * as assessmentsRoute from "@/app/api/v1/development/assessments/route";
import * as competenciesRoute from "@/app/api/v1/development/competencies/route";
import * as goalActionsRoute from "@/app/api/v1/development/goals/[goalId]/actions/route";
import * as goalsRoute from "@/app/api/v1/development/pdis/[pdiId]/goals/route";
import * as pdisRoute from "@/app/api/v1/development/pdis/route";
import { resolveActor } from "@/server/auth/session";
import { classify, getDevelopment, listTeamCompetencyGaps, listTeamDevelopment } from "@/server/modules/development/service";
import { headersWith, signIn } from "../support/auth";
import { testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

async function actorOf(key: string) {
  const session = await signIn("aurora", key);
  return { session, actor: (await resolveActor(headersWith(session.cookie)))! };
}

describe("desenvolvimento de pessoas", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("classifica competências pelo nível esperado do cargo", () => {
    expect(classify(80, 70)).toBe("developed");
    expect(classify(50, 70)).toBe("developing");
    expect(classify(40, 70)).toBe("to_develop");
    expect(classify(null, 70)).toBe("to_develop");
  });

  it("colaborador vê o próprio PDI com progresso e ação atrasada derivada", async () => {
    const { actor } = await actorOf("fernando");
    const dev = await getDevelopment(actor);
    expect(dev.isSelf).toBe(true);
    // Quem lança metas e avaliações é a liderança; o titular só atualiza o andamento.
    expect(dev.canManage).toBe(false);
    expect(dev.canUpdateProgress).toBe(true);
    expect(dev.competencies).toHaveLength(8);
    expect(dev.counts.developed + dev.counts.developing + dev.counts.toDevelop).toBe(8);
    // Andamento do seed varia por pessoa; Fernando está "começando" (2 de 8, duas atrasadas).
    expect(dev.pdi?.goals.map((g) => g.progress)).toEqual([33, 50, 0]);
    expect(dev.pdi?.stats).toEqual({ actionsTotal: 8, actionsDone: 2, actionsLate: 2, progress: 28 });
  });

  it("colaborador conclui a própria ação, mas não acessa o desenvolvimento de colegas", async () => {
    const { session, actor } = await actorOf("gabriel");
    const dev = await getDevelopment(actor);
    const late = dev.pdi!.goals.flatMap((g) => g.actions).find((a) => a.late)!;
    const res = await call(actionRoute.PATCH, { path: "/x", method: "PATCH", cookie: session.cookie, params: { actionId: late.id }, body: { status: "done", evidence: "Recebi feedback do time." } });
    expect(res.status).toBe(200);
    expect((await getDevelopment(actor)).pdi!.stats.actionsLate).toBe(dev.pdi!.stats.actionsLate - 1);

    const camila = await userOf("aurora", "camila");
    await expect(getDevelopment(actor, camila.id)).rejects.toMatchObject({ status: 404 });
    const foreign = (await getDevelopment((await actorOf("camila")).actor)).pdi!.goals[0]!.actions[0]!;
    expect((await call(actionRoute.PATCH, { path: "/x", method: "PATCH", cookie: session.cookie, params: { actionId: foreign.id }, body: { status: "done" } })).status).toBe(404);
  });

  it("gestora acompanha e ajusta a equipe, e avalia como gestora", async () => {
    const { session, actor } = await actorOf("carla");
    const team = await listTeamDevelopment(actor);
    expect(team.members.map((m) => m.name).sort()).toEqual(["Camila Oliveira", "Fernando Santos", "Gabriel Rocha", "Helena Duarte", "Lucas Ferreira"]);
    expect(team.tenantWide).toBe(false);

    const fernando = await userOf("aurora", "fernando");
    const dev = await getDevelopment(actor, fernando.id);
    expect(dev.canManage).toBe(true);
    const competencyId = dev.competencies[0]!.id;
    const res = await call(assessmentsRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body: { userId: fernando.id, competencyId, score: 85 } });
    expect(res.status).toBe(201);
    expect(res.json.source).toBe("manager");

    const joao = await userOf("aurora", "joao");
    await expect(getDevelopment(actor, joao.id)).rejects.toMatchObject({ status: 404 });
    expect((await call(assessmentsRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body: { userId: joao.id, competencyId, score: 10 } })).status).toBe(404);

    const gaps = await listTeamCompetencyGaps(actor);
    expect(gaps).toHaveLength(8);
    expect(gaps.every((g) => g.assessed === 5)).toBe(true);
  });

  it("editor não acessa dados de desenvolvimento de pessoas", async () => {
    const { session, actor } = await actorOf("rafael");
    expect((await listTeamDevelopment(actor)).members).toEqual([]);
    const fernando = await userOf("aurora", "fernando");
    await expect(getDevelopment(actor, fernando.id)).rejects.toMatchObject({ status: 404 });
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body: { name: "X", category: "tecnica" } })).status).toBe(403);
  });

  it("G&G gerencia o catálogo; gestor não; avaliação de G&G tem origem 'people'", async () => {
    const juliana = await actorOf("juliana");
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: juliana.session.cookie, body: { name: "Negociação", category: "comportamental" } })).status).toBe(201);
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: juliana.session.cookie, body: { name: "Negociação", category: "comportamental" } })).status).toBe(409);
    const carla = await actorOf("carla");
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { name: "Outra", category: "tecnica" } })).status).toBe(403);

    const joao = await userOf("aurora", "joao");
    const dev = await getDevelopment(juliana.actor, joao.id);
    const res = await call(assessmentsRoute.POST, { path: "/x", method: "POST", cookie: juliana.session.cookie, body: { userId: joao.id, competencyId: dev.competencies[0]!.id, score: 60 } });
    expect(res.json.source).toBe("people");
  });

  it("um PDI ativo por pessoa; colaborador não cria PDI para colegas", async () => {
    const { session } = await actorOf("helena");
    const body = { title: "PDI extra", periodStart: "2026-01-01", periodEnd: "2026-12-31" };
    expect((await call(pdisRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body })).status).toBe(403);
    const lucas = await userOf("aurora", "lucas");
    expect((await call(pdisRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body: { ...body, userId: lucas.id } })).status).toBe(404);
    const helena = await userOf("aurora", "helena");
    const carla = await actorOf("carla");
    expect((await call(pdisRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { ...body, userId: helena.id } })).status).toBe(409);
  });

  it("colaborador não lança metas, ações nem avaliações; só atualiza o andamento", async () => {
    const { session, actor } = await actorOf("lucas");
    const dev = await getDevelopment(actor);
    const goal = dev.pdi!.goals[0]!;
    const open = dev.pdi!.goals.flatMap((g) => g.actions).find((a) => a.status !== "done")!;
    const cookie = session.cookie;
    expect((await call(goalsRoute.POST, { path: "/x", method: "POST", cookie, params: { pdiId: dev.pdi!.id }, body: { title: "Meta minha" } })).status).toBe(403);
    expect((await call(goalActionsRoute.POST, { path: "/x", method: "POST", cookie, params: { goalId: goal.id }, body: { title: "Ação minha", type: "pratica" } })).status).toBe(403);
    expect((await call(assessmentsRoute.POST, { path: "/x", method: "POST", cookie, body: { competencyId: dev.competencies[0]!.id, score: 100 } })).status).toBe(403);
    expect((await call(actionRoute.PATCH, { path: "/x", method: "PATCH", cookie, params: { actionId: open.id }, body: { title: "Outro título" } })).status).toBe(403);
    expect((await call(actionRoute.PATCH, { path: "/x", method: "PATCH", cookie, params: { actionId: open.id }, body: { status: "cancelled" } })).status).toBe(403);
    expect((await call(actionRoute.PATCH, { path: "/x", method: "PATCH", cookie, params: { actionId: open.id }, body: { status: "in_progress" } })).status).toBe(200);
  });

  it("gestora não lança o próprio desenvolvimento", async () => {
    const { session, actor } = await actorOf("carla");
    expect((await getDevelopment(actor)).canManage).toBe(false);
    const competency = (await getDevelopment(actor)).competencies[0]!;
    expect((await call(assessmentsRoute.POST, { path: "/x", method: "POST", cookie: session.cookie, body: { competencyId: competency.id, score: 100 } })).status).toBe(403);
  });
});
