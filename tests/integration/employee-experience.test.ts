import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as moodRoute from "@/app/api/v1/me/mood/route";
import { withTenant } from "@/server/db/tenant";
import { resolveActor } from "@/server/auth/session";
import { listAnnouncementFeed } from "@/server/modules/announcements/service";
import { getMyLearningProgress, listNextActivities, listRecommendedPaths } from "@/server/modules/learning/service";
import { listMyAchievements } from "@/server/modules/achievements/service";
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
    expect(progress).toEqual({ enrolled: 9, completed: 4, percent: 61 });

    const paths = await listRecommendedPaths(actor);
    expect(paths.map((p) => [p.title, p.courseCount, p.totalMinutes, p.progress])).toEqual([
      ["Desenvolvimento de Liderança", 6, 720, 25],
      ["Comunicação Eficaz", 4, 480, 50],
      ["Inteligência Emocional", 5, 600, 0],
    ]);

    const activities = await listNextActivities(actor);
    expect(activities[0]).toMatchObject({ courseTitle: "Comunicação Não Violenta", remainingMinutes: 30, pathTitle: "Comunicação Eficaz" });
    expect(activities.map((a) => a.kind)).toContain("quiz");

    expect((await listMyAchievements(actor)).length).toBe(4);
    expect((await listAnnouncementFeed(actor)).map((a) => a.title)[0]).toBe("Nova política de trabalho híbrido");
  });

  it("check-in de humor: grava, atualiza no mesmo dia e valida a escala", async () => {
    expect((await call(moodRoute.GET, { path: "/api/v1/me/mood", cookie: fernando.cookie })).json).toEqual({ mood: null });
    expect((await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 4 } })).status).toBe(200);
    expect((await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 2 } })).json).toEqual({ mood: 2 });
    expect((await call(moodRoute.GET, { path: "/api/v1/me/mood", cookie: fernando.cookie })).json).toEqual({ mood: 2 });
    expect((await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 9 } })).status).toBe(400);
    expect((await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 3, userId: paula.userId } })).status).toBe(400);
  });

  it("humor individual é invisível para qualquer outra pessoa, inclusive administradores (RLS)", async () => {
    await call(moodRoute.PUT, { path: "/api/v1/me/mood", method: "PUT", cookie: fernando.cookie, body: { mood: 1 } });
    // A administradora consulta diretamente a tabela, no próprio tenant: não vê nada.
    const visible = await withTenant({ tenantId: paula.tenantId, userId: paula.userId }, async (tx) => {
      const r = await tx.execute(sql`select count(*)::int as n from mood_checkins`);
      return (r as unknown as { rows: { n: number }[] }).rows[0]!.n;
    });
    expect(visible).toBe(0);
    // E não consegue gravar em nome de outra pessoa.
    await expectDbError(
      withTenant({ tenantId: paula.tenantId, userId: paula.userId }, (tx) =>
        tx.execute(sql`insert into mood_checkins (tenant_id, user_id, checkin_date, mood) values (${paula.tenantId}, ${fernando.userId}, '2026-01-01', 5)`),
      ),
      /row-level security/,
    );
  });
});
