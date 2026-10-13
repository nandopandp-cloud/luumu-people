import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as countsRoute from "@/app/api/v1/connections/counts/route";
import * as featuredRoute from "@/app/api/v1/connections/featured/route";
import * as onlineRoute from "@/app/api/v1/connections/online/route";
import * as peopleRoute from "@/app/api/v1/connections/people/route";
import * as dismissRoute from "@/app/api/v1/connections/suggestions/[userId]/dismiss/route";
import * as suggestionsRoute from "@/app/api/v1/connections/suggestions/route";
import * as interestsRoute from "@/app/api/v1/me/interests/route";
import * as presenceRoute from "@/app/api/v1/me/presence/route";
import * as s from "@/server/db/schema";
import { signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

const cookies = new Map<string, string>();
async function cookie(key: string, slug = "aurora") {
  const k = `${slug}:${key}`;
  if (!cookies.has(k)) cookies.set(k, (await signIn(slug, key)).cookie);
  return cookies.get(k)!;
}
const idOf = async (key: string, slug = "aurora") => (await tenantOf(slug)).users.get(key)!.id;

async function asUser<T>(key: string, fn: (tx: Parameters<Parameters<typeof asRole>[1]>[0]) => Promise<T>) {
  const { tenantId } = await tenantOf("aurora");
  const userId = await idOf(key);
  return asRole("luumu_app", async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

type Card = { id: string; name: string; relation: string; commonInterests: string[]; online: boolean; sameTeam: boolean };

describe("conexões", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("sem sessão: 401", async () => {
    const params = { userId: "00000000-0000-4000-8000-000000000000" };
    for (const handler of [peopleRoute.GET, suggestionsRoute.GET, featuredRoute.GET, onlineRoute.GET, countsRoute.GET, interestsRoute.GET]) {
      expect((await call(handler, { path: "/x", params })).status).toBe(401);
    }
    for (const [handler, method] of [
      [dismissRoute.POST, "POST"],
      [interestsRoute.PUT, "PUT"],
    ] as const) {
      expect((await call(handler, { path: "/x", method, params, body: {} })).status).toBe(401);
    }
  });

  it("descobrir: interesses em comum, filtros de time e interesses, só a própria empresa e sem dados de RH", async () => {
    const all = await call(peopleRoute.GET, { path: "/x?limit=60", cookie: await cookie("fernando") });
    expect(all.status).toBe(200);
    const ids = all.json.items.map((c: Card) => c.id);
    expect(ids).not.toContain(await idOf("fernando"));
    expect(ids).not.toContain(await idOf("sergio", "horizonte"));
    expect(JSON.stringify(all.json)).not.toMatch(/@aurora\.example|phone|employeeCode|hireDate/);
    // Afinidade primeiro: a Carla tem 4 interesses em comum com o Fernando.
    const carla = all.json.items.find((c: Card) => c.name === "Carla Mendes");
    expect(carla.commonInterests.sort()).toEqual(["design", "leitura", "produto", "viagens"]);
    expect(all.json.items[0].commonInterests.length).toBeGreaterThanOrEqual(carla.commonInterests.length);

    const interests = await call(peopleRoute.GET, { path: "/x?filtro=interesses&limit=60", cookie: await cookie("fernando") });
    expect(interests.json.items.length).toBeGreaterThan(0);
    expect(interests.json.items.every((c: Card) => c.commonInterests.length > 0)).toBe(true);

    const team = await call(peopleRoute.GET, { path: "/x?filtro=equipe&limit=60", cookie: await cookie("fernando") });
    const teamNames = team.json.items.map((c: Card) => c.name);
    expect(teamNames).toEqual(expect.arrayContaining(["Carla Mendes", "Camila Oliveira", "Gabriel Rocha"]));
    expect(teamNames).not.toContain("Marcos Vieira");
    expect(team.json.items.every((c: Card) => c.sameTeam)).toBe(true);

    // Busca por interesse ("habilidade").
    const photo = await call(peopleRoute.GET, { path: `/x?q=${encodeURIComponent("fotografia")}`, cookie: await cookie("fernando") });
    expect(photo.json.items.map((c: Card) => c.name)).toEqual(expect.arrayContaining(["Rafael Lima", "Larissa Melo", "Lucas Ferreira"]));

    expect((await call(peopleRoute.GET, { path: "/x?interesse=nao-existe", cookie: await cookie("fernando") })).status).toBe(400);
  });

  it("sugestões: sem amigos nem pedidos; o x dispensa só para quem dispensou", async () => {
    const first = await call(suggestionsRoute.GET, { path: "/x?limit=30", cookie: await cookie("fernando") });
    const items = first.json.items as Card[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((c) => c.relation === "none")).toBe(true);
    const target = items[0]!;
    expect((await call(dismissRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), params: { userId: target.id } })).status).toBe(204);
    const after = await call(suggestionsRoute.GET, { path: "/x?limit=30", cookie: await cookie("fernando") });
    expect(after.json.items.map((c: Card) => c.id)).not.toContain(target.id);
    // Dispensa é pessoal: ninguém mais vê (nem altera) as de outra pessoa.
    const leaked = await asUser("carla", (tx) => tx.select().from(s.connectionSuggestionDismissals));
    expect(leaked).toEqual([]);
  });

  it("interesses: só do catálogo, até 12, e cada pessoa altera só os seus", async () => {
    const saved = await call(interestsRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("caio"), body: { keys: ["musica", "games", "cafe"] } });
    expect(saved.json).toEqual({ keys: ["musica", "games", "cafe"] });
    expect((await call(interestsRoute.GET, { path: "/x", cookie: await cookie("caio") })).json.keys.sort()).toEqual(["cafe", "games", "musica"]);
    const replaced = await call(interestsRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("caio"), body: { keys: ["cafe"] } });
    expect(replaced.json.keys).toEqual(["cafe"]);
    expect((await call(interestsRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("caio"), body: { keys: ["hackear"] } })).status).toBe(400);
    const tooMany = ["design", "tecnologia", "dados", "produto", "lideranca", "comunicacao", "educacao", "inovacao", "leitura", "escrita", "idiomas", "musica", "fotografia"];
    expect((await call(interestsRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("caio"), body: { keys: tooMany } })).status).toBe(400);

    const { tenantId } = await tenantOf("aurora");
    const caio = await idOf("caio");
    await expectDbError(
      asUser("simone", (tx) => tx.insert(s.userInterests).values({ tenantId, userId: caio, interestKey: "pets" })),
      /row-level security/,
    );
    const removed = await asUser("simone", (tx) => tx.delete(s.userInterests).where(eq(s.userInterests.userId, caio)).returning({ key: s.userInterests.interestKey }));
    expect(removed).toEqual([]);
  });

  it("online: só amigos; destaques e contadores", async () => {
    await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: await cookie("carla") });
    await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: await cookie("marcos") });
    const online = await call(onlineRoute.GET, { path: "/x", cookie: await cookie("fernando") });
    const names = online.json.items.map((c: Card) => c.name);
    expect(names).toContain("Carla Mendes");
    expect(names).not.toContain("Marcos Vieira"); // online, mas não é amigo do Fernando
    // Presença de quem não é amigo nunca aparece nos cartões.
    const people = await call(peopleRoute.GET, { path: "/x?q=Marcos", cookie: await cookie("fernando") });
    expect(people.json.items.find((c: Card) => c.name === "Marcos Vieira")?.online).toBe(false);

    const featured = await call(featuredRoute.GET, { path: "/x?limit=4", cookie: await cookie("fernando") });
    expect(featured.json.items).toHaveLength(4);
    expect(featured.json.items.map((c: Card) => c.id)).not.toContain(await idOf("fernando"));
    // "Seguir" é o próprio pedido de conexão: o cartão traz a relação, não um vínculo à parte.
    expect(featured.json.items.every((c: Card & { following?: unknown }) => typeof c.relation === "string" && c.following === undefined)).toBe(true);

    const counts = await call(countsRoute.GET, { path: "/x", cookie: await cookie("fernando") });
    expect(counts.json).toMatchObject({ friends: expect.any(Number), received: expect.any(Number), online: expect.any(Number) });
    expect(counts.json.friends).toBeGreaterThanOrEqual(10);
  });
});
