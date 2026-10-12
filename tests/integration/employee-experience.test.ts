import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as dismissRoute from "@/app/api/v1/me/mood/dismiss/route";
import * as moodRoute from "@/app/api/v1/me/mood/route";
import { withTenant } from "@/server/db/tenant";
import { resolveActor } from "@/server/auth/session";
import { listAnnouncementFeed } from "@/server/modules/announcements/service";
import { getMyLearningProgress, listNextActivities, listRecommendedPaths } from "@/server/modules/learning/service";
import { listMyAchievements } from "@/server/modules/achievements/service";
import { myTeamMoods, todayMoodsOf } from "@/server/modules/wellbeing/service";
import { headersWith, signIn } from "../support/auth";
import { expectDbError, testDatabase } from "../support/db";
import { call } from "../support/http";

describe("experiência do colaborador — Início", () => {
  let fernando: Awaited<ReturnType<typeof signIn>>;
  let paula: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    await testDatabase();
    [fernando, paula] = await Promise.all([signIn("aurora", "fernando"), signIn("aurora", "paula")]);
  });

  it("progresso, trilhas, atividades e conquistas vêm do banco e são da própria pessoa", async () => {
    const actor = (await resolveActor(headersWith(fernando.cookie)))!;
    const progress = await getMyLearningProgress(actor);
    expect(progress).toEqual({ enrolled: 9, completed: 4, percent: 63 });

    const paths = await listRecommendedPaths(actor);
    expect(paths.map((p) => [p.title, p.courseCount, p.totalMinutes, p.progress])).toEqual([
      ["Desenvolvimento de Liderança", 6, 720, 25],
      ["Comunicação Eficaz", 4, 480, 54],
      ["Inteligência Emocional", 5, 600, 0],
    ]);

    const activities = await listNextActivities(actor);
    expect(activities[0]).toMatchObject({ courseTitle: "Comunicação Não Violenta", remainingMinutes: 20, pathTitle: "Comunicação Eficaz" });
    expect(activities.map((a) => a.kind)).toContain("quiz");

    expect((await listMyAchievements(actor)).length).toBe(4);
    expect((await listAnnouncementFeed(actor)).map((a) => a.title)[0]).toBe("Nova política de trabalho híbrido");
  });

  it("sentimento do dia: lê o registro de hoje, muda com comentário e valida escala e tamanho", async () => {
    const get = async (cookie: string) => (await call(moodRoute.GET, { path: "/api/v1/me/mood", cookie })).json;
    const put = (body: unknown) => call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body });
    // Seed: Fernando já respondeu hoje.
    expect(await get(fernando.cookie)).toMatchObject({ mood: 5, note: "Dia produtivo e animado para os próximos desafios!", dismissed: false });
    expect((await put({ mood: 6, note: "  Ótimo dia  " })).json).toMatchObject({ mood: 6, note: "Ótimo dia" });
    expect((await put({ mood: 3, note: "" })).json).toMatchObject({ mood: 3, note: null });
    expect(await get(fernando.cookie)).toMatchObject({ mood: 3, note: null, dismissed: false });
    expect((await put({ mood: 7 })).status).toBe(400);
    expect((await put({ mood: 0 })).status).toBe(400);
    expect((await put({ mood: 4, note: "x".repeat(301) })).status).toBe(400);
    expect((await put({ mood: 4, userId: paula.userId })).status).toBe(400);
  });

  it("sem resposta hoje: o modal aparece; 'agora não' fica registrado só para a pessoa", async () => {
    const sofia = await signIn("aurora", "sofia");
    const get = async () => (await call(moodRoute.GET, { path: "/api/v1/me/mood", cookie: sofia.cookie })).json;
    expect(await get()).toEqual({ mood: null, note: null, at: null, dismissed: false });
    const dismiss = () => call(dismissRoute.POST, { path: "/api/v1/me/mood/dismiss", method: "POST", cookie: sofia.cookie });
    expect((await dismiss()).json).toEqual({ dismissed: true });
    expect((await dismiss()).status).toBe(200); // idempotente
    expect(await get()).toMatchObject({ mood: null, dismissed: true });
    // Responder depois continua possível.
    expect((await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: sofia.cookie, body: { mood: 5 } })).json).toMatchObject({ mood: 5, dismissed: false });
    // O "agora não" é pessoal: outra pessoa não vê.
    const seen = await withTenant({ tenantId: paula.tenantId, userId: paula.userId }, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from mood_prompt_dismissals`);
      return (r as unknown as { rows: { n: number }[] }).rows[0]!.n;
    });
    expect(seen).toBe(0);
  });

  it("sentimento é visível para as pessoas da empresa; só a própria pessoa grava (RLS)", async () => {
    const paulaActor = (await resolveActor(headersWith(paula.cookie)))!;
    await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 5, note: "Bora!" } });
    const moods = await todayMoodsOf(paulaActor, [fernando.userId]);
    expect(moods.get(fernando.userId)).toMatchObject({ mood: 5, note: "Bora!" });

    await expectDbError(
      withTenant({ tenantId: paula.tenantId, userId: paula.userId }, (tx) =>
        tx.execute(sql`insert into mood_checkins (tenant_id, user_id, checkin_date, mood) values (${paula.tenantId}, ${fernando.userId}, '2026-01-01', 5)`),
      ),
      /row-level security/,
    );
    const changed = await withTenant({ tenantId: paula.tenantId, userId: paula.userId }, async (tx) => {
      const r = await tx.execute(sql`update mood_checkins set mood = 1 where user_id = ${fernando.userId} returning id`);
      return (r as unknown as { rows: unknown[] }).rows.length;
    });
    expect(changed).toBe(0);
    expect((await todayMoodsOf(paulaActor, [fernando.userId])).get(fernando.userId)?.mood).toBe(5);
  });

  it("visão do gestor: time direto com o sentimento de hoje (quem não respondeu aparece sem registro)", async () => {
    const carla = (await resolveActor(headersWith((await signIn("aurora", "carla")).cookie)))!;
    const team = await myTeamMoods(carla);
    expect(team.map((m) => m.name)).toEqual(["Camila Oliveira", "Fernando Santos", "Gabriel Rocha", "Helena Duarte", "Lucas Ferreira"]);
    expect(team.find((m) => m.name === "Lucas Ferreira")!.today).toBeNull();
    expect(team.find((m) => m.name === "Helena Duarte")!.today).toMatchObject({ mood: 3, note: "Semana puxada, mas seguimos firmes." });
    expect(team.every((m) => m.position)).toBe(true);
    // Quem não tem time não vê nada.
    expect(await myTeamMoods((await resolveActor(headersWith(fernando.cookie)))!)).toEqual([]);
  });
});
