import { beforeAll, describe, expect, it } from "vitest";
import * as actionRoute from "@/app/api/v1/development/actions/[actionId]/route";
import * as assessmentsRoute from "@/app/api/v1/development/assessments/route";
import * as competenciesRoute from "@/app/api/v1/development/competencies/route";
import * as goalActionsRoute from "@/app/api/v1/development/goals/[goalId]/actions/route";
import * as goalRoute from "@/app/api/v1/development/goals/[goalId]/route";
import * as mentorRoute from "@/app/api/v1/development/pdis/[pdiId]/mentor/route";
import * as goalsRoute from "@/app/api/v1/development/pdis/[pdiId]/goals/route";
import * as pdisRoute from "@/app/api/v1/development/pdis/route";
import { resolveActor } from "@/server/auth/session";
import { classify, getDevelopment, listTeamCompetencyGaps, listTeamDevelopment } from "@/server/modules/development/service";
import { listCompetencySuggestions } from "@/server/modules/development/suggestions";
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
    expect(dev.pdi?.stats).toEqual({ actionsTotal: 8, actionsDone: 2, actionsInProgress: 3, actionsNotStarted: 1, actionsLate: 2, progress: 28 });
  });

  it("PDI: ciclos, mentoria, etiquetas, evolução mensal, competências evoluindo e conquistas derivadas", async () => {
    const { actor } = await actorOf("fernando");
    const dev = await getDevelopment(actor);
    const pdi = dev.pdi!;
    expect(dev.pdis).toEqual([expect.objectContaining({ id: pdi.id, status: "active" })]);
    expect(pdi.mentor).toMatchObject({ name: expect.any(String), active: true, note: expect.any(String) });
    expect(pdi.mentor!.id).not.toBe(actor.userId);
    expect(pdi.goals[0]).toMatchObject({ tags: ["Liderança", "Carreira", "Crescimento"], competencyIcon: "crown", description: expect.any(String) });
    // Evolução: no máximo 6 meses; o último ponto é o progresso atual.
    expect(pdi.timeline.length).toBeGreaterThan(0);
    expect(pdi.timeline.length).toBeLessThanOrEqual(6);
    expect(pdi.timeline.at(-1)!.progress).toBe(pdi.stats.progress);
    expect(pdi.timeline.reduce((sum, p) => sum + p.completed, 0)).toBeLessThanOrEqual(pdi.stats.actionsDone);
    // Variação desde a avaliação anterior.
    expect(dev.counts.evolving).toBe(dev.competencies.filter((c) => (c.delta ?? 0) > 0).length);
    expect(dev.counts.evolving).toBeGreaterThan(0);
    // Conquistas: níveis 1–5 inéditos por competência, mais recentes primeiro.
    expect(dev.milestones.length).toBeGreaterThan(0);
    expect(dev.milestones.every((m) => m.level >= 1 && m.level <= 5)).toBe(true);
    const times = dev.milestones.map((m) => m.achievedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // Ciclo de outra pessoa na URL: ignorado (mostra o próprio).
    const other = await getDevelopment((await actorOf("camila")).actor);
    expect((await getDevelopment(actor, actor.userId, { pdiId: other.pdi!.id })).pdi!.id).toBe(pdi.id);
  });

  it("competências: descrição, histórico sem comentários e sugestões do catálogo para o que falta desenvolver", async () => {
    const { actor } = await actorOf("fernando");
    const dev = await getDevelopment(actor);
    expect(dev.canAddCompetency).toBe(false);
    const comunicacao = dev.competencies.find((c) => c.name === "Comunicação")!;
    expect(comunicacao.description).toEqual(expect.any(String));
    expect(comunicacao.history).toHaveLength(3);
    expect(Object.keys(comunicacao.history[0]!).sort()).toEqual(["assessedAt", "score", "source"]);
    expect(comunicacao.history.at(-1)!.score).toBe(comunicacao.score);

    // Força Comunicação abaixo do esperado e Liderança acima: só a primeira recebe sugestões.
    const forced = dev.competencies.map((c) => (c.name === "Comunicação" ? { ...c, level: "to_develop" as const, score: 30 } : c.name === "Liderança" ? { ...c, level: "developed" as const } : c));
    const suggestions = await listCompetencySuggestions(actor, forced);
    const com = suggestions.find((x) => x.competencyName === "Comunicação")!;
    expect(com.items[0]).toMatchObject({ kind: "path", title: "Comunicação Eficaz" });
    expect(com.items.length).toBeLessThanOrEqual(3);
    expect(suggestions.find((x) => x.competencyName === "Liderança")).toBeUndefined();
    expect(await listCompetencySuggestions(actor, forced.map((c) => ({ ...c, level: "developed" as const })))).toEqual([]);

    // Nem G&G adiciona competências pela própria área de colaborador.
    const juliana = await actorOf("juliana");
    expect((await getDevelopment(juliana.actor)).canAddCompetency).toBe(false);
  });

  it("objetivo e mentoria: só a liderança edita; mentoria é um colega ativo e nunca a própria pessoa", async () => {
    const fernando = await actorOf("fernando");
    const dev = await getDevelopment(fernando.actor);
    const goal = dev.pdi!.goals[1]!;
    const patchGoal = (cookie: string, body: unknown) => call(goalRoute.PATCH, { path: "/x", method: "PATCH", cookie, params: { goalId: goal.id }, body });
    const putMentor = (cookie: string, body: unknown) => call(mentorRoute.PUT, { path: "/x", method: "PUT", cookie, params: { pdiId: dev.pdi!.id }, body });

    expect((await patchGoal(fernando.session.cookie, { tags: ["Minha"] })).status).toBe(403);
    expect((await putMentor(fernando.session.cookie, { mentorUserId: null })).status).toBe(403);
    // Fora do escopo de leitura: 404.
    const helena = await actorOf("helena");
    expect((await patchGoal(helena.session.cookie, { tags: ["X"] })).status).toBe(404);

    const carla = await actorOf("carla");
    const edited = await patchGoal(carla.session.cookie, { description: "Falar com clareza.", tags: ["Comunicação", "comunicação", "Palco"] });
    expect(edited.status).toBe(200);
    const after = (await getDevelopment(fernando.actor)).pdi!.goals[1]!;
    expect(after).toMatchObject({ description: "Falar com clareza.", tags: ["Comunicação", "Palco"] });
    expect((await patchGoal(carla.session.cookie, { tags: ["a", "b", "c", "d", "e", "f"] })).status).toBe(400);

    expect((await putMentor(carla.session.cookie, { mentorUserId: fernando.actor.userId })).status).toBe(400);
    const sergio = await userOf("horizonte", "sergio");
    expect((await putMentor(carla.session.cookie, { mentorUserId: sergio.id })).status).toBe(400);
    const juliana = await userOf("aurora", "juliana");
    expect((await putMentor(carla.session.cookie, { mentorUserId: juliana.id, mentorNote: "Conte comigo!" })).status).toBe(200);
    expect((await getDevelopment(fernando.actor)).pdi!.mentor).toMatchObject({ id: juliana.id, note: "Conte comigo!" });
    expect((await putMentor(carla.session.cookie, { mentorUserId: null, mentorNote: "sobra" })).status).toBe(200);
    expect((await getDevelopment(fernando.actor)).pdi!.mentor).toBeNull();
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

  it("G&G gerencia o catálogo; gestor adiciona só pela equipe; avaliação de G&G tem origem 'people'", async () => {
    const juliana = await actorOf("juliana");
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: juliana.session.cookie, body: { name: "Negociação", category: "comportamental" } })).status).toBe(201);
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: juliana.session.cookie, body: { name: "Negociação", category: "comportamental" } })).status).toBe(409);
    // Gestora: só a partir de alguém da própria equipe — nunca de si mesma nem fora do escopo.
    const carla = await actorOf("carla");
    const camila = await userOf("aurora", "camila");
    const outsider = await userOf("aurora", "joao");
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { name: "Outra", category: "tecnica" } })).status).toBe(403);
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { userId: carla.actor.userId, name: "Outra", category: "tecnica" } })).status).toBe(403);
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { userId: outsider.id, name: "Outra", category: "tecnica" } })).status).toBe(404);
    expect((await call(competenciesRoute.POST, { path: "/x", method: "POST", cookie: carla.session.cookie, body: { userId: camila.id, name: "Outra", category: "tecnica" } })).status).toBe(201);
    expect((await getDevelopment(carla.actor, camila.id)).canAddCompetency).toBe(true);

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
