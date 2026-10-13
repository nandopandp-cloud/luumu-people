import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as commentLikeRoute from "@/app/api/v1/announcements/[id]/comments/[commentId]/like/route";
import * as commentRoute from "@/app/api/v1/announcements/[id]/comments/[commentId]/route";
import * as commentsRoute from "@/app/api/v1/announcements/[id]/comments/route";
import * as mentionableRoute from "@/app/api/v1/announcements/[id]/mentionable/route";
import * as archiveRoute from "@/app/api/v1/announcements/[id]/archive/route";
import * as preferencesRoute from "@/app/api/v1/me/notifications/preferences/route";
import * as readAllRoute from "@/app/api/v1/me/notifications/read-all/route";
import * as readRoute from "@/app/api/v1/me/notifications/read/route";
import * as notificationsRoute from "@/app/api/v1/me/notifications/route";
import { mentionToken } from "@/lib/mentions";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { listComments } from "@/server/modules/announcements/engagement";
import { countUnread, listNotifications, type NotificationView } from "@/server/modules/notifications/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

async function actorFor(key: string) {
  return (await resolveActor(headersWith((await signIn("aurora", key)).cookie)))!;
}

async function idOf(title: string) {
  const { db } = await testDatabase();
  const [row] = await db.select({ id: s.announcements.id }).from(s.announcements).where(eq(s.announcements.title, title));
  return row!.id;
}

async function userId(key: string) {
  return (await tenantOf("aurora")).users.get(key)!.id;
}

const keysOf = (items: NotificationView[]) => items.map((n) => n.key);

describe("notificações", () => {
  beforeAll(async () => {
    await testDatabase();
  });

  it("calculadas: novo comunicado respeita o público; nova pesquisa vem do próprio convite", async () => {
    const fernando = await listNotifications(await actorFor("fernando"));
    const bruno = await listNotifications(await actorFor("bruno"));
    const areaOnly = `announcement:${await idOf("Planejamento do trimestre de Produto")}`;
    expect(keysOf(fernando.items)).toContain(areaOnly);
    expect(keysOf(bruno.items)).not.toContain(areaOnly);
    // Agendado e arquivado não notificam.
    expect(keysOf(fernando.items)).not.toContain(`announcement:${await idOf("Festa de fim de ano")}`);
    expect(keysOf(fernando.items)).not.toContain(`announcement:${await idOf("Resultado da campanha do agasalho")}`);

    const survey = fernando.items.find((n) => n.category === "surveys")!;
    expect(survey).toMatchObject({ title: "Nova pesquisa disponível", action: "Responder agora", primary: true, unread: true });
    expect(JSON.stringify(fernando.items)).not.toMatch(/answer|resposta individual/i);
  });

  it("seed: menção, resposta e curtidas agrupadas chegam ao Fernando", async () => {
    const { items, counts } = await listNotifications(await actorFor("fernando"));
    const mention = items.find((n) => n.category === "mentions")!;
    expect(mention).toMatchObject({ title: "Você recebeu uma menção", lead: "Rafael Lima", action: "Ver comentário", unread: true });
    expect(mention.body).toContain("@Fernando Santos o que você acha");
    const reply = items.find((n) => n.category === "comments")!;
    expect(reply).toMatchObject({ title: "Carla Mendes comentou", action: "Ver conversa" });
    const likes = items.filter((n) => n.category === "likes");
    expect(likes).toHaveLength(1);
    expect(likes[0]).toMatchObject({ unread: false, lead: "Juliana, Rafael" });
    expect(likes[0]!.body).toMatch(/^e outras 3 pessoas curtiram seu comentário/);
    expect(likes[0]!.actors).toHaveLength(3);
    expect(counts.mentions).toBe(1);
    // Comentário + curtidas + 2 pedidos de amizade recebidos (Amanda e Diego, do seed).
    expect(counts.groups.interactions).toBe(4);
  });

  it("menção: só quem vê o comunicado; marcador forjado vira texto; sem notificar a si mesmo", async () => {
    const id = await idOf("Planejamento do trimestre de Produto"); // público: Produto
    const { cookie } = await signIn("aurora", "camila"); // Growth ⊂ Produto
    const gabriel = await userId("gabriel"); // Growth
    const bruno = await userId("bruno"); // Backend — fora do público
    const camila = await userId("camila");
    const body = `${mentionToken("Gabriel Rocha", gabriel)} e ${mentionToken("Bruno", bruno)} e ${mentionToken("Eu", camila)} e ${mentionToken("Ninguém", "00000000-0000-4000-8000-000000000000")}`;
    const created = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie, params: { id }, body: { body } });
    expect(created.status).toBe(200);

    const comments = await listComments(await actorFor("camila"), id);
    const mine = comments.find((c) => c.id === created.json.id)!;
    expect(mine.parts.filter((p) => p.type === "mention").map((p) => p.type === "mention" && p.userId)).toEqual([gabriel]);
    expect(mine.parts.map((p) => (p.type === "text" ? p.value : `@${p.name}`)).join("")).toBe("@Gabriel Rocha e @Bruno e @Eu e @Ninguém");

    const { db } = await testDatabase();
    const sent = await db.select({ recipientId: s.notifications.recipientId }).from(s.notifications).where(eq(s.notifications.commentId, created.json.id));
    expect(sent.map((n) => n.recipientId)).toEqual([gabriel]);

    // Sugestões de menção: só o público do comunicado, só nome e foto.
    const suggestions = await call(mentionableRoute.GET, { path: "/x?q=br", cookie, params: { id } });
    expect((suggestions.json.items as { name: string }[]).map((p) => p.name)).not.toContain("Bruno Martins");
    const all = await call(mentionableRoute.GET, { path: "/x?q=ga", cookie, params: { id } });
    expect(all.json.items[0]).toEqual({ id: gabriel, name: "Gabriel Rocha", image: null });
    // "@" sozinho: todo o público do comunicado, em ordem alfabética (sem quem está fora dele).
    const everyone = await call(mentionableRoute.GET, { path: "/x", cookie, params: { id } });
    const names = (everyone.json.items as { name: string }[]).map((p) => p.name);
    expect(names.length).toBeGreaterThan(all.json.items.length);
    expect(names).toContain("Gabriel Rocha");
    expect(names).not.toContain("Bruno Martins");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("resposta e curtida em comentário geram notificação; descurtir desfaz; removido some", async () => {
    const id = await idOf("Simulado de evacuação do prédio");
    const author = await signIn("aurora", "isabela");
    const root = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: author.cookie, params: { id }, body: { body: "Qual escada usar?" } });
    const other = await signIn("aurora", "diego");
    const reply = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: other.cookie, params: { id }, body: { body: "A da ala norte.", parentId: root.json.id } });
    expect(reply.status).toBe(200);
    // Resposta de resposta vira resposta do comentário de primeiro nível.
    const nested = await call(commentsRoute.POST, { path: "/x", method: "POST", cookie: other.cookie, params: { id }, body: { body: "Ou a sul.", parentId: reply.json.id } });
    const { db } = await testDatabase();
    const [row] = await db.select({ parentId: s.announcementComments.parentId }).from(s.announcementComments).where(eq(s.announcementComments.id, nested.json.id));
    expect(row!.parentId).toBe(root.json.id);

    const isabela = await actorFor("isabela");
    expect((await listNotifications(isabela)).items.filter((n) => n.category === "comments" && n.href.includes(id))).toHaveLength(2);

    const like = await call(commentLikeRoute.POST, { path: "/x", method: "POST", cookie: other.cookie, params: { id, commentId: root.json.id } });
    expect(like.json).toEqual({ likes: 1, likedByMe: true });
    expect((await listNotifications(isabela)).items.some((n) => n.key === `like:${root.json.id}`)).toBe(true);
    const unlike = await call(commentLikeRoute.DELETE, { path: "/x", method: "DELETE", cookie: other.cookie, params: { id, commentId: root.json.id } });
    expect(unlike.json).toEqual({ likes: 0, likedByMe: false });
    expect((await listNotifications(isabela)).items.some((n) => n.key === `like:${root.json.id}`)).toBe(false);

    // Comentário removido: a notificação da resposta some.
    await call(commentRoute.DELETE, { path: "/x", method: "DELETE", cookie: other.cookie, params: { id, commentId: nested.json.id } });
    expect((await listNotifications(isabela)).items.filter((n) => n.category === "comments" && n.href.includes(id))).toHaveLength(1);
  });

  it("lida, não lida, marcar todas e preferências (categoria silenciada some e não conta)", async () => {
    const { cookie } = await signIn("aurora", "fernando");
    const fernando = await actorFor("fernando");
    const before = await listNotifications(fernando);
    const target = before.items.find((n) => n.category === "announcements" && n.unread)!;

    const read = await call(readRoute.POST, { path: "/x", method: "POST", cookie, body: { keys: [target.key] } });
    expect(read.json.unread).toBe(before.counts.unread - 1);
    const again = await call(readRoute.POST, { path: "/x", method: "POST", cookie, body: { keys: [target.key], read: false } });
    expect(again.json.unread).toBe(before.counts.unread);

    const filtered = await call(notificationsRoute.GET, { path: "/x?aba=mencoes", cookie });
    expect((filtered.json.items as NotificationView[]).every((n) => n.category === "mentions")).toBe(true);
    expect((await call(notificationsRoute.GET, { path: "/x?aba=qualquer", cookie })).status).toBe(400);
    expect((await call(readRoute.POST, { path: "/x", method: "POST", cookie, body: { keys: ["survey:abc"] } })).status).toBe(400);

    await call(preferencesRoute.PUT, { path: "/x", method: "PUT", cookie, body: { muted: ["announcements"] } });
    const muted = await listNotifications(fernando);
    expect(muted.items.some((n) => n.category === "announcements")).toBe(false);
    expect(muted.counts.groups.announcements).toBe(0);
    await call(preferencesRoute.PUT, { path: "/x", method: "PUT", cookie, body: { muted: [] } });

    expect((await call(readAllRoute.POST, { path: "/x", method: "POST", cookie })).json).toEqual({ unread: 0 });
    expect(await countUnread(fernando)).toBe(0);
  });

  it("comunicado arquivado leva junto as notificações dele", async () => {
    const id = await idOf("Planejamento do trimestre de Produto");
    const gabriel = await actorFor("gabriel");
    expect((await listNotifications(gabriel)).items.some((n) => n.href.startsWith(`/comunicados/${id}`))).toBe(true);
    const editor = await signIn("aurora", "rafael");
    expect((await call(archiveRoute.POST, { path: "/x", method: "POST", cookie: editor.cookie, params: { id } })).status).toBe(200);
    expect((await listNotifications(gabriel)).items.some((n) => n.href.startsWith(`/comunicados/${id}`))).toBe(false);
  });

  it("banco: ninguém lê as notificações de outra pessoa nem cria em nome de outra", async () => {
    const { tenantId } = await tenantOf("aurora");
    const fernando = await userId("fernando");
    const bruno = await userId("bruno");
    const asUser = (user: string) => sql`select set_config('app.tenant_id', ${tenantId}, true), set_config('app.user_id', ${user}, true)`;

    // Bruno só enxerga, das notificações do Fernando, as que ele mesmo gerou (curtida que pode desfazer).
    const seen = await asRole("luumu_app", async (tx) => {
      await tx.execute(asUser(bruno));
      return tx.select({ actorId: s.notifications.actorId }).from(s.notifications).where(eq(s.notifications.recipientId, fernando));
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((n) => n.actorId === bruno)).toBe(true);
    const { db: owner } = await testDatabase();
    const total = await owner.select({ actorId: s.notifications.actorId }).from(s.notifications).where(eq(s.notifications.recipientId, fernando));
    expect(total.some((n) => n.actorId !== bruno)).toBe(true);

    const { db } = await testDatabase();
    const [comment] = await db.select({ id: s.announcementComments.id, announcementId: s.announcementComments.announcementId }).from(s.announcementComments).limit(1);
    await expectDbError(
      asRole("luumu_app", async (tx) => {
        await tx.execute(asUser(bruno));
        await tx.insert(s.notifications).values({ tenantId, recipientId: bruno, actorId: fernando, type: "mention", announcementId: comment!.announcementId, commentId: comment!.id });
      }),
      /row-level security/,
    );
    const reads = await asRole("luumu_app", async (tx) => {
      await tx.execute(asUser(bruno));
      return tx.select().from(s.notificationReads).where(and(eq(s.notificationReads.userId, fernando)));
    });
    expect(reads).toEqual([]);
  });
});
