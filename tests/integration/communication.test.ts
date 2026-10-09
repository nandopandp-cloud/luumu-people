import { desc, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as commentRoute from "@/app/api/v1/announcements/[id]/comments/[commentId]/route";
import * as commentsRoute from "@/app/api/v1/announcements/[id]/comments/route";
import * as likeRoute from "@/app/api/v1/announcements/[id]/like/route";
import * as itemRoute from "@/app/api/v1/announcements/[id]/route";
import * as createRoute from "@/app/api/v1/announcements/route";
import * as eventsRoute from "@/app/api/v1/events/route";
import * as quickLinkItemRoute from "@/app/api/v1/quick-links/[id]/route";
import * as quickLinkOrderRoute from "@/app/api/v1/quick-links/order/route";
import * as quickLinksRoute from "@/app/api/v1/quick-links/route";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { getAnnouncement, listAnnouncements, listFeaturedAnnouncements, listWeeklyHighlights } from "@/server/modules/announcements/service";
import { listUpcomingEvents } from "@/server/modules/communication/events";
import { listActiveQuickLinks } from "@/server/modules/communication/quick-links";
import { search } from "@/server/modules/search/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

async function actorFor(key: string) {
  return (await resolveActor(headersWith((await signIn("aurora", key)).cookie)))!;
}

const AREA_ONLY = "Planejamento do trimestre de Produto";

async function idOf(title: string) {
  const { db } = await testDatabase();
  const [row] = await db.select({ id: s.announcements.id }).from(s.announcements).where(eq(s.announcements.title, title));
  return row!.id;
}

describe("mural de comunicados", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("público por área: só quem está na área (ou subárea) vê, inclusive na busca e no detalhe", async () => {
    const fernando = await actorFor("fernando"); // Growth ⊂ Produto
    const bruno = await actorFor("bruno"); // Backend ⊂ Engenharia
    const id = await idOf(AREA_ONLY);

    expect((await listAnnouncements(fernando, { limit: 50 })).items.map((a) => a.title)).toContain(AREA_ONLY);
    expect((await listAnnouncements(fernando, { tab: "minha-area", limit: 50 })).items.map((a) => a.title)).toEqual([AREA_ONLY]);
    expect((await getAnnouncement(fernando, id)).title).toBe(AREA_ONLY);

    expect((await listAnnouncements(bruno, { limit: 50 })).items.map((a) => a.title)).not.toContain(AREA_ONLY);
    expect((await listAnnouncements(bruno, { tab: "minha-area", limit: 50 })).items).toEqual([]);
    await expect(getAnnouncement(bruno, id)).rejects.toMatchObject({ status: 404 });
    const titles = async (actor: typeof bruno) => (await search(actor, "trimestre", "employee")).flatMap((g) => g.items.map((i) => i.title));
    expect(await titles(bruno)).not.toContain(AREA_ONLY);
    expect(await titles(fernando)).toContain(AREA_ONLY);

    // Nem curtir nem comentar o que não se vê.
    const { cookie } = await signIn("aurora", "bruno");
    expect((await call(likeRoute.POST, { path: "/x", method: "POST", cookie, params: { id } })).status).toBe(404);
    expect((await call(commentsRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: { body: "Oi" } })).status).toBe(404);
  });

  it("abas, destaques e comunicado da semana", async () => {
    const actor = await actorFor("gabriel");
    const important = await listAnnouncements(actor, { tab: "importantes", limit: 50 });
    expect(important.items.every((a) => a.pinned)).toBe(true);
    expect((await listFeaturedAnnouncements(actor)).map((a) => a.title)).toEqual(["Nova política de trabalho híbrido", "Semana da Diversidade"]);
    const week = await listWeeklyHighlights(actor);
    expect(week.length).toBeGreaterThan(0);
    const old = await listAnnouncements(actor, { period: "7d", limit: 50 });
    expect(old.items.map((a) => a.title)).not.toContain("Simulado de evacuação do prédio"); // 9 dias atrás
    const withCounts = (await listAnnouncements(actor, { limit: 50 })).items.find((a) => a.title === "Semana da Diversidade")!;
    expect(withCounts.videos).toBe(1);
    expect(withCounts.comments).toBe(1);
  });

  it("curtir: uma vez por pessoa, só em nome próprio (API e banco)", async () => {
    const id = await idOf("Programa de Saúde Mental");
    const { cookie } = await signIn("aurora", "leticia");
    const before = (await getAnnouncement(await actorFor("leticia"), id)).likes;
    const liked = await call(likeRoute.POST, { path: "/x", method: "POST", cookie, params: { id } });
    expect(liked.json).toEqual({ likes: before + 1, likedByMe: true });
    const again = await call(likeRoute.POST, { path: "/x", method: "POST", cookie, params: { id } });
    expect(again.json).toEqual({ likes: before + 1, likedByMe: true });
    const unliked = await call(likeRoute.DELETE, { path: "/x", method: "DELETE", cookie, params: { id } });
    expect(unliked.json).toEqual({ likes: before, likedByMe: false });

    // A role de runtime não grava curtida em nome de outra pessoa.
    const tenantId = (await tenantOf("aurora")).tenantId;
    const { db } = await testDatabase();
    const [someone] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, "camila.oliveira@aurora.example"));
    const [me] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, "leticia.barros@aurora.example"));
    await expectDbError(
      asRole("luumu_app", async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${me!.id}, true)`);
        await tx.insert(s.announcementReactions).values({ tenantId, announcementId: id, userId: someone!.id });
      }),
      /row-level security/,
    );
  });

  it("comentários: autor remove o seu; outra pessoa não; moderação remove e fica auditado", async () => {
    const id = await idOf("Programa de Saúde Mental");
    const author = await signIn("aurora", "diego");
    const created = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: author.cookie, params: { id }, body: { body: "  Participarei do encontro!  " } });
    expect(created.status).toBe(200);
    const list = await call(commentsRoute.GET, { path: "/x", cookie: author.cookie, params: { id } });
    const mine = (list.json.items as { id: string; body: string; canDelete: boolean }[]).find((c) => c.id === created.json.id)!;
    expect(mine).toMatchObject({ body: "Participarei do encontro!", canDelete: true });
    expect((await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: author.cookie, params: { id }, body: { body: "x".repeat(1001) } })).status).toBe(400);

    const other = await signIn("aurora", "isabela");
    const params = { id, commentId: created.json.id };
    expect((await call(commentRoute.DELETE, { path: "/x", method: "DELETE", cookie: other.cookie, params })).status).toBe(403);

    const moderator = await signIn("aurora", "rafael");
    expect((await call(commentRoute.DELETE, { path: "/x", method: "DELETE", cookie: moderator.cookie, params })).status).toBe(204);
    const after = await call(commentsRoute.GET, { path: "/x", cookie: author.cookie, params: { id } });
    expect((after.json.items as { id: string }[]).map((c) => c.id)).not.toContain(created.json.id);

    const { db } = await testDatabase();
    const [log] = await db.select({ action: s.auditLogs.action, metadata: s.auditLogs.metadata }).from(s.auditLogs).where(eq(s.auditLogs.action, "comms.comment_removed")).orderBy(desc(s.auditLogs.createdAt)).limit(1);
    expect(log?.metadata).toEqual({ commentId: created.json.id });

    // Autor remove o próprio (sem auditoria de moderação).
    const second = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: author.cookie, params: { id }, body: { body: "Outro" } });
    expect((await call(commentRoute.DELETE, { path: "/x", method: "DELETE", cookie: author.cookie, params: { id, commentId: second.json.id } })).status).toBe(204);
  });

  it("anexos: só vídeo do YouTube/Vimeo e arquivos enviados como anexo; público precisa ser área do tenant", async () => {
    const { cookie } = await signIn("aurora", "rafael");
    const base = { title: "Com anexos", summary: "Resumo", category: "institucional", theme: "blue", illustration: "calendar" };
    for (const videoUrl of ["https://exemplo.com/video.mp4", "javascript:alert(1)", "http://youtube.com/watch?v=abcdefgh"]) {
      const res = await call(createRoute.POST, { path: "/x", method: "POST", cookie, body: { ...base, attachments: [{ kind: "video", title: "Vídeo", videoUrl }] } });
      expect(res.status, videoUrl).toBe(400);
    }
    const ok = await call(createRoute.POST, {
      path: "/x",
      method: "POST",
      cookie,
      body: { ...base, attachments: [{ kind: "video", title: "Abertura", videoUrl: "https://youtu.be/abcdefgh123" }] },
    });
    expect(ok.status).toBe(200);
    const saved = await call(itemRoute.GET, { path: "/x", cookie, params: { id: ok.json.id } });
    expect(saved.json.attachments).toMatchObject([{ kind: "video", title: "Abertura", videoUrl: "https://youtu.be/abcdefgh123" }]);

    const { db } = await testDatabase();
    const [cover] = await db.select({ id: s.files.id }).from(s.files).where(eq(s.files.purpose, "announcement_cover")).limit(1);
    if (cover) {
      const wrong = await call(createRoute.POST, { path: "/x", method: "POST", cookie, body: { ...base, attachments: [{ kind: "file", title: "PDF", fileId: cover.id }] } });
      expect(wrong.status).toBe(400);
    }
    const [otherTenantUnit] = await db
      .select({ id: s.orgUnits.id })
      .from(s.orgUnits)
      .where(eq(s.orgUnits.tenantId, (await tenantOf("horizonte")).tenantId))
      .limit(1);
    const foreign = await call(createRoute.POST, { path: "/x", method: "POST", cookie, body: { ...base, audienceOrgUnitId: otherTenantUnit!.id } });
    expect(foreign.status).toBe(400);
  });

  it("eventos: colaborador vê só os publicados e futuros; gestão exige permissão e valida local", async () => {
    const actor = await actorFor("fernando");
    const upcoming = await listUpcomingEvents(actor, 10);
    expect(upcoming.map((e) => e.title)).toEqual(["Roda de conversa: Saúde Mental", "Workshop de Produtividade", "Café com o Time de Produto", "Palestra: Liderança Inclusiva"]);

    const collaborator = await signIn("aurora", "fernando");
    expect((await call(eventsRoute.GET, { path: "/x", cookie: collaborator.cookie })).status).toBe(403);

    const { cookie } = await signIn("aurora", "rafael");
    const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const noPlace = await call(eventsRoute.POST, { path: "/x", method: "POST", cookie, body: { title: "Feira", kind: "evento", mode: "presencial", startsAt, published: true } });
    expect(noPlace.status).toBe(400);
    const badUrl = await call(eventsRoute.POST, { path: "/x", method: "POST", cookie, body: { title: "Feira", kind: "evento", mode: "online", url: "http://x.example", startsAt } });
    expect(badUrl.status).toBe(400);
    const created = await call(eventsRoute.POST, { path: "/x", method: "POST", cookie, body: { title: "Feira de carreiras", kind: "evento", mode: "presencial", location: "Sede", startsAt, published: true } });
    expect(created.status).toBe(200);
    expect((await listUpcomingEvents(actor, 10)).map((e) => e.title)).toContain("Feira de carreiras");
  });

  it("links rápidos: destino seguro, ordem e permissão", async () => {
    const collaborator = await signIn("aurora", "fernando");
    expect((await call(quickLinksRoute.POST, { path: "/x", method: "POST", cookie: collaborator.cookie, body: { label: "X", url: "/comunicados", icon: "link", color: "blue" } })).status).toBe(403);

    const { cookie } = await signIn("aurora", "rafael");
    for (const url of ["javascript:alert(1)", "http://exemplo.com", "//evil.example"]) {
      expect((await call(quickLinksRoute.POST, { path: "/x", method: "POST", cookie, body: { label: "X", url, icon: "link", color: "blue" } })).status, url).toBe(400);
    }
    const created = await call(quickLinksRoute.POST, { path: "/x", method: "POST", cookie, body: { label: "Holerite", url: "https://rh.aurora.example", icon: "wallet", color: "green" } });
    expect(created.status).toBe(200);
    const { json } = await call(quickLinksRoute.GET, { path: "/x", cookie });
    const ids = (json.items as { id: string }[]).map((l) => l.id);
    const reordered = [created.json.id, ...ids.filter((id) => id !== created.json.id)];
    expect((await call(quickLinkOrderRoute.PUT, { path: "/x", method: "PUT", cookie, body: { ids: reordered } })).status).toBe(204);
    const actor = await actorFor("fernando");
    expect((await listActiveQuickLinks(actor))[0]!.label).toBe("Holerite");

    expect((await call(quickLinkItemRoute.PUT, { path: "/x", method: "PUT", cookie, params: { id: created.json.id }, body: { label: "Holerite", url: "https://rh.aurora.example", icon: "wallet", color: "green", active: false } })).status).toBe(200);
    expect((await listActiveQuickLinks(actor)).map((l) => l.label)).not.toContain("Holerite");
    expect((await call(quickLinkItemRoute.DELETE, { path: "/x", method: "DELETE", cookie, params: { id: created.json.id } })).status).toBe(204);
  });
});
