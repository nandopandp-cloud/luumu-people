import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as presenceRoute from "@/app/api/v1/me/presence/route";
import { resolveActor } from "@/server/auth/session";
import { listRecentActivity } from "@/server/modules/audit/service";
import { getAttentionItems, getManagementOverview } from "@/server/modules/management/service";
import { getPlatformUsage } from "@/server/modules/usage/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, testDatabase, userOf } from "../support/db";
import { call } from "../support/http";

async function actorOf(key: string) {
  const session = await signIn("aurora", key);
  return { session, actor: (await resolveActor(headersWith(session.cookie)))! };
}

describe("dashboard de gestão", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("indicadores: pessoas, áreas, gestores e admissões dentro do escopo", async () => {
    const admin = await getManagementOverview((await actorOf("paula")).actor);
    expect(admin.peopleInScope).toBeGreaterThan(10);
    expect(admin.managers).toBeGreaterThan(0);
    expect(admin.orgUnits).toBeGreaterThan(0);
    expect(admin.recentHires).toEqual(expect.any(Number));
    expect(admin.peopleChange).toEqual(expect.any(Number));

    const manager = await getManagementOverview((await actorOf("carla")).actor);
    expect(manager.managers).toBeNull();
    expect(manager.peopleInScope).toBeLessThan(admin.peopleInScope!);
  });

  it("uso da plataforma: só agregado e só para relatórios da empresa toda", async () => {
    const usage = await getPlatformUsage((await actorOf("paula")).actor, 7);
    expect(usage.days).toHaveLength(7);
    expect(usage.totals.visits).toBe(usage.days.reduce((sum, d) => sum + d.visits, 0));
    expect(usage.totals.users).toBeGreaterThan(0);
    expect(usage.totals.avgSeconds).toBeGreaterThan(0);
    // Nada por pessoa no retorno.
    expect(Object.keys(usage.days[0]!).sort()).toEqual(["day", "users", "visits"]);
    expect((await getPlatformUsage((await actorOf("paula")).actor, 30)).days).toHaveLength(30);

    await expect(getPlatformUsage((await actorOf("carla")).actor, 7)).rejects.toMatchObject({ status: 403 });
    await expect(getPlatformUsage((await actorOf("rafael")).actor, 7)).rejects.toMatchObject({ status: 403 });
  });

  it("o sinal de presença registra o uso do dia, sem contar duas vezes em sequência", async () => {
    const { session } = await actorOf("natalia");
    const natalia = await userOf("aurora", "natalia");
    const { db } = await testDatabase();
    await db.execute(sql`delete from usage_days where user_id = ${natalia.id} and day = (now() at time zone 'America/Sao_Paulo')::date`);

    expect((await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: session.cookie })).status).toBeLessThan(300);
    expect((await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: session.cookie })).status).toBeLessThan(300);
    const read = async () =>
      (
        (await db.execute(sql`select visits, active_seconds as "activeSeconds" from usage_days where user_id = ${natalia.id} and day = (now() at time zone 'America/Sao_Paulo')::date`)) as unknown as {
          rows: { visits: number; activeSeconds: number }[];
        }
      ).rows;
    expect(await read()).toEqual([{ visits: 1, activeSeconds: 0 }]);

    // 90 s depois: mesmo acesso, soma o intervalo.
    await db.execute(sql`update usage_days set last_seen_at = now() - interval '90 seconds' where user_id = ${natalia.id} and day = (now() at time zone 'America/Sao_Paulo')::date`);
    await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: session.cookie });
    expect((await read())[0]!.visits).toBe(1);
    expect((await read())[0]!.activeSeconds).toBeGreaterThanOrEqual(89);

    // 1 h depois: novo acesso, sem somar o tempo parado.
    await db.execute(sql`update usage_days set last_seen_at = now() - interval '1 hour' where user_id = ${natalia.id} and day = (now() at time zone 'America/Sao_Paulo')::date`);
    await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: session.cookie });
    const after = (await read())[0]!;
    expect(after.visits).toBe(2);
    expect(after.activeSeconds).toBeLessThan(200);
  });

  it("RLS: ninguém grava o uso de outra pessoa", async () => {
    const natalia = await userOf("aurora", "natalia");
    const fernando = await userOf("aurora", "fernando");
    await expectDbError(
      asRole("luumu_app", async (db) => {
        await db.execute(sql`select set_config('app.tenant_id', ${natalia.tenantId}, true), set_config('app.user_id', ${natalia.id}, true)`);
        await db.execute(sql`insert into usage_days (tenant_id, user_id, day) values (${natalia.tenantId}, ${fernando.id}, current_date + 1)`);
      }),
      /row-level security/,
    );
  });

  it("atenção necessária: cada item segue a permissão de quem vê", async () => {
    const admin = await getAttentionItems((await actorOf("paula")).actor);
    expect(admin.latePdis).toEqual(expect.any(Number));
    expect(admin.closingSurveys).toEqual(expect.any(Array));
    expect(admin.pendingInvites).toEqual(expect.any(Number));

    const manager = await getAttentionItems((await actorOf("carla")).actor);
    expect(manager.latePdis).toEqual(expect.any(Number));
    expect(manager.closingSurveys).toBeNull();
    expect(manager.latePdis).toBeLessThanOrEqual(admin.latePdis!);

    const editor = await getAttentionItems((await actorOf("rafael")).actor);
    expect(editor).toEqual({ latePdis: null, closingSurveys: null, pendingInvites: null });
  });

  it("atividade recente: sem eventos de login e só para quem lê a auditoria", async () => {
    const items = await listRecentActivity((await actorOf("paula")).actor, 5);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => !i.action.startsWith("auth."))).toBe(true);
    await expect(listRecentActivity((await actorOf("carla")).actor)).rejects.toMatchObject({ status: 403 });
  });
});
