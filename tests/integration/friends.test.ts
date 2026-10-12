import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/v1/files/[id]/route";
import * as filesRoute from "@/app/api/v1/files/route";
import * as friendRoute from "@/app/api/v1/friends/[userId]/route";
import * as profileRoute from "@/app/api/v1/friends/[userId]/profile/route";
import * as peopleRoute from "@/app/api/v1/friends/people/route";
import * as acceptRoute from "@/app/api/v1/friends/requests/[userId]/accept/route";
import * as requestRoute from "@/app/api/v1/friends/requests/[userId]/route";
import * as requestsRoute from "@/app/api/v1/friends/requests/route";
import * as friendsRoute from "@/app/api/v1/friends/route";
import * as conversationRoute from "@/app/api/v1/conversations/[id]/route";
import * as mediaRoute from "@/app/api/v1/conversations/[id]/media/route";
import * as memberRoute from "@/app/api/v1/conversations/[id]/members/[userId]/route";
import * as membersRoute from "@/app/api/v1/conversations/[id]/members/route";
import * as likeRoute from "@/app/api/v1/conversations/[id]/messages/[messageId]/like/route";
import * as messageRoute from "@/app/api/v1/conversations/[id]/messages/[messageId]/route";
import * as messagesRoute from "@/app/api/v1/conversations/[id]/messages/route";
import * as readRoute from "@/app/api/v1/conversations/[id]/read/route";
import * as typingRoute from "@/app/api/v1/conversations/[id]/typing/route";
import * as conversationsRoute from "@/app/api/v1/conversations/route";
import * as presenceRoute from "@/app/api/v1/me/presence/route";
import { resolveActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { friendsBadgeCount } from "@/server/modules/friends/conversations";
import { listNotifications } from "@/server/modules/notifications/service";
import { headersWith, signIn } from "../support/auth";
import { asRole, expectDbError, tenantOf, testDatabase } from "../support/db";
import { call } from "../support/http";

const ORIGIN = "http://localhost:3000";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

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

async function direct(a: string, b: string) {
  const res = await call(conversationsRoute.POST, { path: "/x", method: "POST", cookie: await cookie(a), body: { kind: "direct", userId: await idOf(b) } });
  return res;
}

async function send(key: string, conversationId: string, body: Record<string, unknown>) {
  return call(messagesRoute.POST, { path: "/x", method: "POST", cookie: await cookie(key), params: { id: conversationId }, body });
}

async function messages(key: string, conversationId: string) {
  return call(messagesRoute.GET, { path: "/x", cookie: await cookie(key), params: { id: conversationId } });
}

describe("amigos e conversas", () => {
  beforeAll(async () => {
    process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "luumu-test-"));
    await testDatabase();
  });

  it("sem sessão: 401 em todas as rotas", async () => {
    const params = { id: "00000000-0000-4000-8000-000000000000", userId: "00000000-0000-4000-8000-000000000000", messageId: "00000000-0000-4000-8000-000000000000" };
    for (const handler of [friendsRoute.GET, peopleRoute.GET, requestsRoute.GET, conversationsRoute.GET, profileRoute.GET, conversationRoute.GET, messagesRoute.GET, mediaRoute.GET]) {
      expect((await call(handler, { path: "/x", params })).status).toBe(401);
    }
    for (const handler of [requestsRoute.POST, conversationsRoute.POST, messagesRoute.POST, readRoute.POST, typingRoute.POST, presenceRoute.POST, acceptRoute.POST]) {
      expect((await call(handler, { path: "/x", method: "POST", params, body: {} })).status).toBe(401);
    }
  });

  it("pessoas: só colegas ativos da empresa, sem e-mail ou dados de RH; amigos e pedidos primeiro", async () => {
    const res = await call(peopleRoute.GET, { path: "/x?limit=60", cookie: await cookie("fernando") });
    expect(res.status).toBe(200);
    const ids = res.json.items.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(await idOf("fernando"));
    expect(ids).not.toContain(await idOf("sergio", "horizonte"));
    expect(res.json.total).toBe(res.json.items.length);
    expect(JSON.stringify(res.json)).not.toMatch(/@aurora\.example|phone|employeeCode|hireDate|manager/);
    expect(res.json.items[0].relation).toBe("received");
    expect(res.json.items.find((p: { name: string }) => p.name === "Carla Mendes")).toMatchObject({ relation: "friends", position: "Head", orgUnit: "Produto", location: "Rio de Janeiro, RJ" });

    const search = await call(peopleRoute.GET, { path: "/x?q=designer", cookie: await cookie("fernando") });
    expect(search.json.items.map((p: { name: string }) => p.name).sort()).toEqual(["Larissa Melo", "Rafael Lima"]);
  });

  it("perfil do colega: 404 para outra empresa e para si; amigos e grupos em comum", async () => {
    const other = await call(profileRoute.GET, { path: "/x", cookie: await cookie("fernando"), params: { userId: await idOf("sergio", "horizonte") } });
    expect(other.status).toBe(404);
    const self = await call(profileRoute.GET, { path: "/x", cookie: await cookie("fernando"), params: { userId: await idOf("fernando") } });
    expect(self.status).toBe(404);
    const carla = await call(profileRoute.GET, { path: "/x", cookie: await cookie("fernando"), params: { userId: await idOf("carla") } });
    expect(carla.status).toBe(200);
    expect(carla.json).toMatchObject({ name: "Carla Mendes", relation: "friends", headline: expect.stringContaining("Produto") });
    expect(carla.json.mutualCount).toBeGreaterThanOrEqual(4);
    expect(carla.json.groupsInCommon.map((g: { title: string }) => g.title)).toEqual(["Time Produto"]);
    expect(carla.json.directConversationId).toBeTruthy();
  });

  it("pedidos: enviar, ver, aceitar só quem recebe; recusar e cancelar", async () => {
    const marcos = await idOf("marcos");
    const fernando = await idOf("fernando");
    expect((await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { userId: marcos } })).json).toEqual({ relation: "sent" });
    // Pedir de novo não duplica.
    expect((await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { userId: marcos } })).json).toEqual({ relation: "sent" });

    const received = await call(requestsRoute.GET, { path: "/x", cookie: await cookie("marcos") });
    expect(received.json.received.map((r: { person: { id: string } }) => r.person.id)).toContain(fernando);
    // Quem pediu não pode aceitar o próprio pedido.
    expect((await call(acceptRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), params: { userId: marcos } })).status).toBe(404);
    // Terceiros não veem pedidos alheios.
    const other = await call(requestsRoute.GET, { path: "/x", cookie: await cookie("tatiane") });
    expect(JSON.stringify(other.json)).not.toContain(marcos);

    expect((await call(acceptRoute.POST, { path: "/x", method: "POST", cookie: await cookie("marcos"), params: { userId: fernando } })).json).toEqual({ relation: "friends" });
    expect((await call(friendRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("marcos"), params: { userId: fernando } })).status).toBe(200);

    // Cancelar o enviado e recusar o recebido.
    const thiago = await idOf("thiago");
    expect((await call(requestRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { userId: thiago } })).json).toEqual({ relation: "none" });
    const amanda = await idOf("amanda");
    expect((await call(requestRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { userId: amanda } })).json).toEqual({ relation: "none" });
    expect((await call(requestRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { userId: amanda } })).status).toBe(404);
    // Pedido recebido + pedir de volta = amizade.
    const diego = await idOf("diego");
    expect((await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { userId: diego } })).json).toEqual({ relation: "friends" });
    // Pessoa de outra empresa: 404.
    expect((await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { userId: await idOf("igor", "horizonte") } })).status).toBe(404);
  });

  it("banco: pedido só em nome próprio e aceite só por quem recebe", async () => {
    const { tenantId } = await tenantOf("aurora");
    const [roberta, simone] = [await idOf("roberta"), await idOf("simone")];
    await expectDbError(
      asUser("bruno", (tx) => tx.insert(s.friendships).values({ tenantId, requesterId: roberta, addresseeId: simone })),
      /row-level security/,
    );
    await asUser("roberta", (tx) => tx.insert(s.friendships).values({ tenantId, requesterId: roberta, addresseeId: simone }));
    // Quem pediu não consegue aceitar (a linha nem é atualizável para ela).
    const updated = await asUser("roberta", (tx) => tx.update(s.friendships).set({ status: "accepted", respondedAt: new Date() }).where(eq(s.friendships.addresseeId, simone)).returning({ id: s.friendships.id }));
    expect(updated).toEqual([]);
    // Pedido pendente é invisível para terceiros.
    const seen = await asUser("bruno", (tx) => tx.select().from(s.friendships).where(and(eq(s.friendships.requesterId, roberta), eq(s.friendships.addresseeId, simone))));
    expect(seen).toEqual([]);
  });

  it("conversa privada: só entre amigos, uma por par, e invisível para terceiros", async () => {
    expect((await direct("fernando", "marcos")).status).toBe(404);
    const first = await direct("fernando", "gabriel");
    expect(first.status).toBe(201);
    const again = await direct("gabriel", "fernando");
    expect(again.json.id).toBe(first.json.id);
    const id = first.json.id as string;

    const sent = await send("fernando", id, { body: "  Oi, Gabriel! Bora revisar o funil?  " });
    expect(sent.status).toBe(201);
    expect(sent.json).toMatchObject({ body: "Oi, Gabriel! Bora revisar o funil?", mine: true, deleted: false });

    const seen = await messages("gabriel", id);
    expect(seen.json.items.at(-1)).toMatchObject({ body: "Oi, Gabriel! Bora revisar o funil?", mine: false, senderName: "Fernando Santos" });

    // Terceiros, mesmo da gestão: 404 na API e nada no banco.
    for (const key of ["paula", "carla"]) {
      expect((await messages(key, id)).status).toBe(404);
      expect((await call(conversationRoute.GET, { path: "/x", cookie: await cookie(key), params: { id } })).status).toBe(404);
      expect((await send(key, id, { body: "intrusa" })).status).toBe(404);
    }
    const leaked = await asUser("paula", (tx) => tx.select().from(s.chatMessages).where(eq(s.chatMessages.conversationId, id)));
    expect(leaked).toEqual([]);
    const elsewhere = await call(messagesRoute.GET, { path: "/x", cookie: await cookie("sergio", "horizonte"), params: { id } });
    expect(elsewhere.status).toBe(404);
  });

  it("leitura, digitação, presença e contador do menu", async () => {
    const fernando = (await resolveActor(headersWith(await cookie("fernando"))))!;
    const before = await friendsBadgeCount(fernando);
    expect(before).toBeGreaterThanOrEqual(2); // Carla e Rafael (não lidas)

    const list = await call(conversationsRoute.GET, { path: "/x", cookie: await cookie("fernando") });
    const carla = list.json.items.find((c: { title: string }) => c.title === "Carla Mendes");
    expect(carla).toMatchObject({ kind: "direct", unread: 1, lastMessage: { preview: "Show! Vamos sim! 💜", mine: false } });
    expect(list.json.items.find((c: { title: string }) => c.title === "Time Produto")).toMatchObject({ kind: "group", memberCount: 6 });

    expect((await call(readRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), params: { id: carla.id } })).status).toBe(204);
    expect(await friendsBadgeCount(fernando)).toBe(before - 1);

    await call(typingRoute.POST, { path: "/x", method: "POST", cookie: await cookie("carla"), params: { id: carla.id } });
    await call(presenceRoute.POST, { path: "/x", method: "POST", cookie: await cookie("carla") });
    const page = await messages("fernando", carla.id);
    expect(page.json.typing).toEqual(["Carla"]);
    expect(page.json.online).toEqual([await idOf("carla")]);
    expect(page.json.items).toHaveLength(5);
    // A Carla leu tudo: as mensagens do Fernando aparecem como lidas.
    const mine = page.json.items.filter((m: { mine: boolean }) => m.mine).at(-1);
    expect(new Date(page.json.othersReadAt).getTime()).toBeGreaterThanOrEqual(new Date(mine.at).getTime());
  });

  it("grupo: criado com amigos; administração gerencia; quem entra depois não vê o histórico; quem sai perde o acesso", async () => {
    const [camila, gabriel, helena, marcos] = [await idOf("camila"), await idOf("gabriel"), await idOf("helena"), await idOf("marcos")];
    const notFriend = await call(conversationsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { kind: "group", title: "Squad", memberIds: [camila, marcos] } });
    expect(notFriend.status).toBe(400);
    const created = await call(conversationsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { kind: "group", title: "Squad Growth 🚀", memberIds: [camila] } });
    expect(created.status).toBe(201);
    const id = created.json.id as string;
    await send("camila", id, { body: "Antes da Helena entrar" });

    // Só a administração adiciona, renomeia e remove.
    expect((await call(membersRoute.POST, { path: "/x", method: "POST", cookie: await cookie("camila"), params: { id }, body: { userIds: [gabriel] } })).status).toBe(403);
    expect((await call(conversationRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("camila"), params: { id }, body: { title: "Meu grupo" } })).status).toBe(403);
    expect((await call(membersRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), params: { id }, body: { userIds: [helena, gabriel] } })).status).toBe(204);
    expect((await call(conversationRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("fernando"), params: { id }, body: { title: "Squad Growth" } })).status).toBe(204);

    const helenaView = await messages("helena", id);
    expect(helenaView.status).toBe(200);
    expect(helenaView.json.items.map((m: { body: string }) => m.body)).not.toContain("Antes da Helena entrar");
    expect((await messages("camila", id)).json.items.map((m: { body: string }) => m.body)).toContain("Antes da Helena entrar");

    // Membro não se promove sozinho (trigger no banco).
    await expectDbError(
      asUser("camila", (tx) => tx.update(s.conversationMembers).set({ role: "admin" }).where(and(eq(s.conversationMembers.conversationId, id), eq(s.conversationMembers.userId, camila)))),
      /administração do grupo/,
    );

    expect((await call(memberRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("camila"), params: { id, userId: gabriel } })).status).toBe(403);
    expect((await call(memberRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { id, userId: gabriel } })).status).toBe(204);
    expect((await messages("gabriel", id)).status).toBe(404);

    // A administração sai: quem está há mais tempo assume.
    expect((await call(memberRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { id, userId: await idOf("fernando") } })).status).toBe(204);
    expect((await messages("fernando", id)).status).toBe(404);
    const detail = await call(conversationRoute.GET, { path: "/x", cookie: await cookie("camila"), params: { id } });
    expect(detail.json).toMatchObject({ title: "Squad Growth", myRole: "admin" });
    expect(detail.json.members.map((m: { name: string }) => m.name).sort()).toEqual(["Camila Oliveira", "Helena Duarte"]);
  });

  it("mensagens: apagar descarta o conteúdo; editar só o próprio texto; desfazer a amizade bloqueia novas mensagens", async () => {
    const conversation = await direct("fernando", "pedro");
    const id = conversation.json.id as string;
    const msg = await send("pedro", id, { body: "Mensagem que vou apagar" });
    expect((await call(messageRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { id, messageId: msg.json.id } })).status).toBe(404);
    expect((await call(messageRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("pedro"), params: { id, messageId: msg.json.id } })).status).toBe(204);
    const after = (await messages("fernando", id)).json.items.find((m: { id: string }) => m.id === msg.json.id);
    expect(after).toMatchObject({ deleted: true, body: "", file: null });
    const { db } = await testDatabase();
    const [row] = await db.select({ body: s.chatMessages.body }).from(s.chatMessages).where(eq(s.chatMessages.id, msg.json.id));
    expect(row?.body).toBe("");

    const kept = await send("pedro", id, { body: "Origianl" });
    // Só quem enviou edita; a mensagem fica marcada como editada.
    expect((await call(messageRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("fernando"), params: { id, messageId: kept.json.id }, body: { body: "invasão" } })).status).toBe(404);
    const fixed = await call(messageRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("pedro"), params: { id, messageId: kept.json.id }, body: { body: "Original" } });
    expect(fixed.status).toBe(200);
    expect(fixed.json).toMatchObject({ body: "Original", edited: true });
    expect((await messages("fernando", id)).json.items.find((m: { id: string }) => m.id === kept.json.id)).toMatchObject({ body: "Original", edited: true });
    expect((await call(messageRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("pedro"), params: { id, messageId: kept.json.id }, body: { body: "   " } })).status).toBe(400);
    // No banco: mensagem apagada não volta, e ninguém edita a de outra pessoa.
    await expectDbError(
      asUser("pedro", (tx) => tx.update(s.chatMessages).set({ body: "ressuscitada" }).where(eq(s.chatMessages.id, msg.json.id))),
      /apagada não pode ser alterada/,
    );
    const hijack = await asUser("fernando", (tx) => tx.update(s.chatMessages).set({ body: "editada por outra pessoa" }).where(eq(s.chatMessages.id, kept.json.id)).returning({ id: s.chatMessages.id }));
    expect(hijack).toEqual([]);
    const { tenantId } = await tenantOf("aurora");
    await expectDbError(
      asUser("fernando", (tx) => tx.insert(s.chatMessages).values({ tenantId, conversationId: id, senderId: kept.json.senderId, body: "em nome do Pedro" })),
      /row-level security/,
    );

    expect((await call(friendRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { userId: await idOf("pedro") } })).status).toBe(200);
    const blocked = await send("pedro", id, { body: "Ainda posso?" });
    expect(blocked.status).toBe(409);
    expect((await messages("pedro", id)).json.items.map((m: { body: string }) => m.body)).toContain("Original");
    expect((await call(messageRoute.PATCH, { path: "/x", method: "PATCH", cookie: await cookie("pedro"), params: { id, messageId: kept.json.id }, body: { body: "Ainda edito?" } })).status).toBe(409);
    const detail = await call(conversationRoute.GET, { path: "/x", cookie: await cookie("fernando"), params: { id } });
    expect(detail.json.blocked).toMatch(/não são mais amigos/);
  });

  it("anexos: só participantes baixam; terceiros recebem 404; o anexo não é reaproveitado", async () => {
    const form = new FormData();
    form.set("file", new File([PNG as Uint8Array<ArrayBuffer>], "print da tela.png"));
    const upload = await filesRoute.POST(
      new Request(`${ORIGIN}/api/v1/files?purpose=chat_attachment`, { method: "POST", body: form, headers: { cookie: await cookie("rafael"), origin: ORIGIN, "sec-fetch-site": "same-origin" } }),
      { params: Promise.resolve({}) },
    );
    expect(upload.status).toBe(201);
    const fileId = (await upload.json()).id as string;
    const download = async (key: string) => fileRoute.GET(new Request(`${ORIGIN}/api/v1/files/${fileId}`, { headers: { cookie: await cookie(key) } }), { params: Promise.resolve({ id: fileId }) });

    // Antes de enviar, só quem subiu vê.
    expect((await download("rafael")).status).toBe(200);
    expect((await download("fernando")).status).toBe(404);

    const id = (await direct("rafael", "fernando")).json.id as string;
    const sent = await send("rafael", id, { fileId });
    expect(sent.json.file).toMatchObject({ name: "print da tela.png", mimeType: "image/png" });
    expect((await download("fernando")).status).toBe(200);
    expect((await download("paula")).status).toBe(404);
    expect((await send("rafael", id, { fileId })).status).toBe(400);
    // Anexo de outra pessoa não pode ser usado.
    expect((await send("fernando", id, { fileId })).status).toBe(400);

    const media = await call(mediaRoute.GET, { path: "/x", cookie: await cookie("fernando"), params: { id } });
    expect(media.json.images.map((f: { id: string }) => f.id)).toContain(fileId);
    await send("fernando", id, { body: "Olha esse link https://luumu.example/guia." });
    const links = await call(mediaRoute.GET, { path: "/x", cookie: await cookie("rafael"), params: { id } });
    expect(links.json.links[0].url).toBe("https://luumu.example/guia");
  });

  it("entrada inválida: campos extras e mensagem vazia → 400", async () => {
    const carla = (await direct("fernando", "carla")).json.id as string;
    expect((await send("fernando", carla, { body: "   " })).status).toBe(400);
    expect((await send("fernando", carla, { body: "oi", senderId: await idOf("carla") })).status).toBe(400);
    expect((await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("fernando"), body: { userId: "não-é-uuid" } })).status).toBe(400);
  });

  it("curtidas: em nome próprio, só por quem vê a mensagem; a atualização periódica traz a mudança", async () => {
    const id = (await direct("fernando", "larissa")).json.id as string;
    const msg = await send("larissa", id, { body: "Curte aí 💜" });
    const before = new Date().toISOString();
    const liked = await call(likeRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("fernando"), params: { id, messageId: msg.json.id } });
    expect(liked.status).toBe(200);
    expect(liked.json).toMatchObject({ likes: 1, likedByMe: true, likedBy: ["Fernando Santos"] });
    // Idempotente.
    expect((await call(likeRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("fernando"), params: { id, messageId: msg.json.id } })).json.likes).toBe(1);

    const seen = await call(messagesRoute.GET, { path: `/x?after=${encodeURIComponent(before)}`, cookie: await cookie("larissa"), params: { id } });
    expect(seen.json.items.find((m: { id: string }) => m.id === msg.json.id)).toMatchObject({ likes: 1, likedByMe: false });

    // Fora da conversa: 404 e nada no banco.
    expect((await call(likeRoute.PUT, { path: "/x", method: "PUT", cookie: await cookie("paula"), params: { id, messageId: msg.json.id } })).status).toBe(404);
    const { tenantId } = await tenantOf("aurora");
    const [paula, fernando] = [await idOf("paula"), await idOf("fernando")];
    await expectDbError(
      asUser("paula", (tx) => tx.insert(s.chatMessageLikes).values({ tenantId, messageId: msg.json.id, userId: paula })),
      /row-level security/,
    );
    const unliked = await call(likeRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("fernando"), params: { id, messageId: msg.json.id } });
    expect(unliked.json).toMatchObject({ likes: 0, likedByMe: false });
    // Curtir em nome de outra pessoa (mesmo participando): recusado.
    await expectDbError(
      asUser("larissa", (tx) => tx.insert(s.chatMessageLikes).values({ tenantId, messageId: msg.json.id, userId: fernando })),
      /row-level security/,
    );
  });

  it("sino: pedido de amizade recebido e pedido aceito viram notificação; recusado some", async () => {
    const [simone, otavio] = [await idOf("simone"), await idOf("otavio")];
    await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("simone"), body: { userId: otavio } });
    const actorOf = async (key: string) => (await resolveActor(headersWith(await cookie(key))))!;
    const inbox = await listNotifications(await actorOf("otavio"));
    const request = inbox.items.find((n) => n.category === "friends")!;
    expect(request).toMatchObject({ title: "Novo pedido de amizade", lead: "Simone Batista", href: "/conversas?aba=solicitacoes", unread: true });

    await call(acceptRoute.POST, { path: "/x", method: "POST", cookie: await cookie("otavio"), params: { userId: simone } });
    expect((await listNotifications(await actorOf("otavio"))).items.some((n) => n.key === request.key)).toBe(false);
    const accepted = (await listNotifications(await actorOf("simone"))).items.find((n) => n.category === "friends")!;
    expect(accepted).toMatchObject({ title: "Pedido de amizade aceito", lead: "Otávio Ferraz", href: `/pessoas/${otavio}` });

    // Recusado: some do sino de quem recebeu.
    const caio = await idOf("caio");
    await call(requestsRoute.POST, { path: "/x", method: "POST", cookie: await cookie("caio"), body: { userId: otavio } });
    expect((await listNotifications(await actorOf("otavio"))).items.filter((n) => n.title === "Novo pedido de amizade")).toHaveLength(1);
    await call(requestRoute.DELETE, { path: "/x", method: "DELETE", cookie: await cookie("otavio"), params: { userId: caio } });
    expect((await listNotifications(await actorOf("otavio"))).items.filter((n) => n.title === "Novo pedido de amizade")).toHaveLength(0);
  });

  it("anexo: ?download=1 entrega como anexo", async () => {
    const form = new FormData();
    form.set("file", new File([PNG as Uint8Array<ArrayBuffer>], "comprovante.png"));
    const upload = await filesRoute.POST(
      new Request(`${ORIGIN}/api/v1/files?purpose=chat_attachment`, { method: "POST", body: form, headers: { cookie: await cookie("fernando"), origin: ORIGIN, "sec-fetch-site": "same-origin" } }),
      { params: Promise.resolve({}) },
    );
    const fileId = (await upload.json()).id as string;
    const res = await fileRoute.GET(new Request(`${ORIGIN}/api/v1/files/${fileId}?download=1`, { headers: { cookie: await cookie("fernando") } }), { params: Promise.resolve({ id: fileId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename\*=UTF-8''comprovante\.png$/);
  });
});
