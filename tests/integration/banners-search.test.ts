import { beforeAll, describe, expect, it } from "vitest";
import * as itemRoute from "@/app/api/v1/banners/[id]/route";
import * as orderRoute from "@/app/api/v1/banners/order/route";
import * as bannersRoute from "@/app/api/v1/banners/route";
import * as searchRoute from "@/app/api/v1/search/route";
import { resolveActor } from "@/server/auth/session";
import { listLiveBanners } from "@/server/modules/banners/service";
import { effectiveFlags } from "@/server/modules/flags/service";
import { search } from "@/server/modules/search/service";
import { headersWith, signIn } from "../support/auth";
import { testDatabase } from "../support/db";
import { call } from "../support/http";

async function actorFor(key: string) {
  return (await resolveActor(headersWith((await signIn("aurora", key)).cookie)))!;
}

const banner = { title: "Feira de carreiras", subtitle: "Dia 20, no auditório.", ctaLabel: "Saiba mais", ctaUrl: "/comunicados", theme: "blue", illustration: "people", active: true };

describe("banners da home", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("home mostra só banners ativos e dentro do período, na ordem definida", async () => {
    const reader = await actorFor("fernando");
    expect((await listLiveBanners(reader)).map((b) => b.title)).toEqual(["Pequenos aprendizados constroem grandes futuros."]);

    const { cookie } = await signIn("aurora", "rafael");
    const created = await call(bannersRoute.POST, { path: "/api/v1/banners", method: "POST", cookie, body: banner });
    expect(created.status).toBe(200);
    const future = await call(bannersRoute.POST, {
      path: "/api/v1/banners",
      method: "POST",
      cookie,
      body: { ...banner, title: "Ainda não", startsAt: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(future.status).toBe(200);
    const ended = await call(bannersRoute.POST, {
      path: "/api/v1/banners",
      method: "POST",
      cookie,
      body: { ...banner, title: "Já passou", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" },
    });
    expect(ended.status).toBe(200);
    expect((await listLiveBanners(reader)).map((b) => b.title)).toEqual(["Pequenos aprendizados constroem grandes futuros.", "Feira de carreiras"]);

    const { json } = await call(bannersRoute.GET, { path: "/api/v1/banners", cookie });
    const ids = (json.items as { id: string }[]).map((b) => b.id);
    const reordered = [created.json.id, ...ids.filter((id) => id !== created.json.id)];
    expect((await call(orderRoute.PUT, { path: "/x", method: "PUT", cookie, body: { ids: reordered } })).status).toBe(204);
    expect((await listLiveBanners(reader))[0]!.title).toBe("Feira de carreiras");
    expect((await call(orderRoute.PUT, { path: "/x", method: "PUT", cookie, body: { ids: reordered.slice(1) } })).status).toBe(400);

    expect((await call(itemRoute.DELETE, { path: "/x", method: "DELETE", cookie, params: { id: created.json.id } })).status).toBe(204);
    expect((await listLiveBanners(reader)).map((b) => b.title)).not.toContain("Feira de carreiras");
  });

  it("destino do botão só aceita caminho interno ou https", async () => {
    const { cookie } = await signIn("aurora", "rafael");
    for (const ctaUrl of ["javascript:alert(1)", "http://exemplo.com", "//evil.example", "trilhas"]) {
      const res = await call(bannersRoute.POST, { path: "/api/v1/banners", method: "POST", cookie, body: { ...banner, ctaUrl } });
      expect(res.status, ctaUrl).toBe(400);
    }
    const half = await call(bannersRoute.POST, { path: "/api/v1/banners", method: "POST", cookie, body: { ...banner, ctaUrl: null } });
    expect(half.status).toBe(400);
  });

  it("só quem publica comunicados gerencia banners", async () => {
    for (const key of ["fernando", "carla"]) {
      const { cookie } = await signIn("aurora", key);
      expect((await call(bannersRoute.POST, { path: "/api/v1/banners", method: "POST", cookie, body: banner })).status, key).toBe(403);
      expect((await call(bannersRoute.GET, { path: "/api/v1/banners", cookie })).status, key).toBe(403);
    }
  });
});

describe("busca unificada", () => {
  it("encontra cursos, trilhas e comunicados sem acento e sem diferenciar caixa", async () => {
    const actor = await actorFor("fernando");
    const groups = await search(actor, "LIDERANCA", "employee");
    const titles = groups.flatMap((g) => g.items.map((i) => `${g.kind}:${i.title}`));
    expect(titles).toContain("path:Desenvolvimento de Liderança");
    expect(titles.some((t) => t.startsWith("course:"))).toBe(true);
    expect(groups.find((g) => g.kind === "announcement")?.items.map((i) => i.title)).toContain("Inscrições abertas para a Escola de Líderes");
  });

  it("nunca devolve rascunho, agendado ou pessoas para quem não pode ver", async () => {
    const actor = await actorFor("fernando");
    const titles = (await search(actor, "festa", "employee")).flatMap((g) => g.items.map((i) => i.title));
    expect(titles).not.toContain("Festa de fim de ano");
    expect((await search(actor, "beneficio", "employee")).flatMap((g) => g.items.map((i) => i.title))).not.toContain("Novo benefício de educação (rascunho)");
    expect((await search(actor, "carla", "employee")).some((g) => g.kind === "person")).toBe(false);
  });

  it("gestão: pessoas só no escopo de quem busca", async () => {
    const manager = await actorFor("carla");
    const people = (await search(manager, "fernando", "management")).find((g) => g.kind === "person")?.items ?? [];
    expect(people.map((p) => p.title)).toContain("Fernando Santos");
    const outside = (await search(manager, "joão", "management")).find((g) => g.kind === "person")?.items ?? [];
    expect(outside).toEqual([]);
  });

  it("API: termo curto devolve atalhos; conquistas ficam fora enquanto ocultas", async () => {
    const { cookie } = await signIn("aurora", "fernando");
    const res = await call(searchRoute.GET, { path: "/api/v1/search?q=", cookie });
    expect(res.status).toBe(200);
    expect(res.json.quick.map((q: { href: string }) => q.href)).toContain("/trilhas");
    const conquistas = await call(searchRoute.GET, { path: "/api/v1/search?q=conquistas", cookie });
    expect(JSON.stringify(conquistas.json)).not.toContain("/minhas-conquistas");
  });
});

describe("conquistas ocultas", () => {
  it("a flag gamification vem desligada por padrão", async () => {
    expect((await effectiveFlags(await actorFor("fernando"))).gamification).toBe(false);
  });
});
