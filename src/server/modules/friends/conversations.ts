import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { fileUrl } from "@/server/modules/files/service";
import type { ChatFile, ChatMessage, ConversationDetail, ConversationSummary, MemberView, MessagesPage, SharedMedia } from "@/features/friends/types";
import { GROUP_MAX_MEMBERS, type MessagesQuery, type NewConversation, type SendMessage } from "./schemas";
import { countReceivedRequests } from "./service";
import { colleagues, directKeyOf, displayName, moodsOf, ONLINE_WINDOW, onlineSql } from "./shared";

/**
 * Conversas privadas e em grupo entre colaboradores da empresa.
 *
 * Privacidade: só quem participa lê a conversa, e só as mensagens enviadas a
 * partir da própria entrada (RLS + app.chat_member_since). Fora disso, 404.
 * Ninguém da gestão lê conversas; nada aqui é auditado nem registrado em log
 * (o conteúdo é da pessoa). Mensagens não são editadas: quem enviou pode
 * apagar, e o texto e o anexo são descartados.
 *
 * Regras: qualquer colaborador ativo da mesma empresa conversa com outro —
 * amizade (conexão) não é exigida; com a outra pessoa inativa, o histórico fica
 * e novas mensagens são bloqueadas. Só a administração do grupo renomeia,
 * adiciona e remove pessoas.
 */

const TYPING_WINDOW = sql`interval '6 seconds'`;
/** Atualização periódica: reenvia o que mudou nos últimos segundos (transações concorrentes). */
const OVERLAP_MS = 30_000;
const PAGE = 40;

type Membership = { kind: "direct" | "group"; title: string | null; role: "admin" | "member"; joinedAt: Date };

/** A conversa, se a pessoa participa dela (senão 404 — não revela que existe). */
async function membership(tx: Tx, actor: AuthenticatedActor, conversationId: string): Promise<Membership> {
  const [row] = await tx
    .select({ kind: s.conversations.kind, title: s.conversations.title, role: s.conversationMembers.role, joinedAt: s.conversationMembers.joinedAt })
    .from(s.conversationMembers)
    .innerJoin(s.conversations, eq(s.conversations.id, s.conversationMembers.conversationId))
    .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, actor.userId), isNull(s.conversationMembers.leftAt)));
  if (!row) throw notFound("Conversa não encontrada.");
  return row;
}

/** Ids, entre `ids`, de colaboradores ativos da empresa (RLS: só o próprio tenant) além da pessoa atual. */
async function activeColleaguesAmong(tx: Tx, actor: AuthenticatedActor, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await tx
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(inArray(s.users.id, ids), eq(s.users.status, "active"), ne(s.users.id, actor.userId)));
  return new Set(rows.map((r) => r.id));
}

function filePreview(mimeType: string | null) {
  return mimeType?.startsWith("image/") ? "📷 Foto" : "📎 Arquivo";
}

type ListRow = {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  created_by: string;
  created_at: string | Date;
  last_body: string | null;
  last_mime: string | null;
  last_file: string | null;
  last_deleted: string | Date | null;
  last_at: string | Date | null;
  last_sender: string | null;
  unread: number;
  member_count: number;
};

const iso = (value: string | Date) => new Date(value).toISOString();

/** Conversas da pessoa, da atividade mais recente para a mais antiga. */
export async function listConversations(actor: AuthenticatedActor): Promise<ConversationSummary[]> {
  return withTenant(actor, async (tx) => {
    const result = await tx.execute(sql`
      select c.id, c.kind, c.title, c.created_by, c.created_at,
        lm.body as last_body, f.mime_type as last_mime, lm.file_id as last_file, lm.deleted_at as last_deleted,
        lm.created_at as last_at, lm.sender_id as last_sender,
        (select count(*)::int from chat_messages u
          where u.conversation_id = c.id and u.sender_id <> ${actor.userId} and u.deleted_at is null
            and (m.last_read_at is null or u.created_at > m.last_read_at)) as unread,
        (select count(*)::int from conversation_members x where x.conversation_id = c.id and x.left_at is null) as member_count
      from conversation_members m
      join conversations c on c.id = m.conversation_id
      left join lateral (
        select x.body, x.file_id, x.deleted_at, x.created_at, x.sender_id from chat_messages x
        where x.conversation_id = c.id order by x.created_at desc limit 1
      ) lm on true
      left join files f on f.id = lm.file_id
      where m.user_id = ${actor.userId} and m.left_at is null
        and (c.kind = 'group' or lm.created_at is not null or c.created_by = ${actor.userId})
      order by coalesce(lm.created_at, c.created_at) desc
      limit 100
    `);
    const rows = (result as unknown as { rows: ListRow[] }).rows;
    if (rows.length === 0) return [];

    const people = await tx
      .select({
        conversationId: s.conversationMembers.conversationId,
        leftAt: s.conversationMembers.leftAt,
        id: s.users.id,
        name: displayName,
        image: s.users.image,
        online: onlineSql(sql`${s.users.id}`),
      })
      .from(s.conversationMembers)
      .innerJoin(s.users, eq(s.users.id, s.conversationMembers.userId))
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(
        inArray(
          s.conversationMembers.conversationId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(s.conversationMembers.joinedAt));
    const names = new Map(people.map((p) => [p.id, p.name]));
    const directOthers = rows.filter((r) => r.kind === "direct").map((r) => people.find((p) => p.conversationId === r.id && p.id !== actor.userId)?.id ?? "");
    const moods = await moodsOf(tx, directOthers.filter(Boolean));

    return rows.map((r): ConversationSummary => {
      const others = people.filter((p) => p.conversationId === r.id && p.id !== actor.userId && !p.leftAt);
      const other = r.kind === "direct" ? (people.find((p) => p.conversationId === r.id && p.id !== actor.userId) ?? null) : null;
      const mine = r.last_sender === actor.userId;
      const lastMessage = r.last_at
        ? {
            preview: r.last_deleted ? "Mensagem apagada" : r.last_body?.trim() ? r.last_body.trim().slice(0, 120) : filePreview(r.last_mime),
            senderName: mine ? "Você" : (names.get(r.last_sender ?? "")?.split(/\s+/)[0] ?? ""),
            mine,
            at: iso(r.last_at),
            hasFile: Boolean(r.last_file),
            deleted: Boolean(r.last_deleted),
          }
        : null;
      return {
        id: r.id,
        kind: r.kind,
        title: r.kind === "group" ? (r.title ?? "") : (other?.name ?? "Conversa"),
        image: other?.image ?? null,
        other: other ? { id: other.id, name: other.name, image: other.image, online: other.online, mood: moods.get(other.id) ?? null } : null,
        members: others.slice(0, 3).map(({ id, name, image }) => ({ id, name, image })),
        memberCount: r.member_count,
        lastMessage,
        unread: r.unread,
        activityAt: iso(r.last_at ?? r.created_at),
      };
    });
  });
}

/** Detalhes da conversa: participantes ativos, papel da pessoa e se é possível enviar. */
export async function getConversation(actor: AuthenticatedActor, conversationId: string): Promise<ConversationDetail> {
  return withTenant(actor, async (tx) => {
    const me = await membership(tx, actor, conversationId);
    const memberRows = await tx
      .select({ userId: s.conversationMembers.userId, role: s.conversationMembers.role })
      .from(s.conversationMembers)
      .where(and(eq(s.conversationMembers.conversationId, conversationId), isNull(s.conversationMembers.leftAt)))
      .orderBy(asc(s.conversationMembers.joinedAt));
    const roles = new Map(memberRows.map((m) => [m.userId, m.role]));
    const cards = await colleagues(tx, actor.userId).where(
      inArray(
        s.users.id,
        memberRows.map((m) => m.userId),
      ),
    );
    const moods = await moodsOf(
      tx,
      cards.map((c) => c.id),
    );
    const members: MemberView[] = memberRows
      .map((m) => cards.find((c) => c.id === m.userId))
      .filter((c) => c !== undefined)
      .map((c) => ({ id: c.id, name: c.name, image: c.image, role: roles.get(c.id) ?? "member", position: c.position, online: c.id !== actor.userId && c.online, mood: moods.get(c.id) ?? null }));

    let otherId: string | null = null;
    let blocked: string | null = null;
    if (me.kind === "direct") {
      const [other] = await tx
        .select({ id: s.users.id, status: s.users.status })
        .from(s.conversationMembers)
        .innerJoin(s.users, eq(s.users.id, s.conversationMembers.userId))
        .where(and(eq(s.conversationMembers.conversationId, conversationId), ne(s.conversationMembers.userId, actor.userId)));
      otherId = other?.id ?? null;
      blocked = directBlock(other);
    }
    const otherName = members.find((m) => m.id === otherId)?.name;
    return { id: conversationId, kind: me.kind, title: me.kind === "group" ? (me.title ?? "") : (otherName ?? "Conversa"), myRole: me.role, members, otherId, blocked };
  });
}

/** Conversa privada: só com a outra pessoa ativa na empresa. */
function directBlock(other: { id: string; status: string } | undefined): string | null {
  return !other || other.status !== "active" ? "Esta pessoa não está mais ativa na empresa." : null;
}

/** Conversa privada: envio e edição só enquanto a outra pessoa estiver ativa (senão 409). */
async function assertCanSend(tx: Tx, actor: AuthenticatedActor, conversationId: string) {
  const [other] = await tx
    .select({ id: s.users.id, status: s.users.status })
    .from(s.conversationMembers)
    .innerJoin(s.users, eq(s.users.id, s.conversationMembers.userId))
    .where(and(eq(s.conversationMembers.conversationId, conversationId), ne(s.conversationMembers.userId, actor.userId)));
  const blocked = directBlock(other);
  if (blocked) throw conflict(blocked);
}

/**
 * Abre uma conversa privada com um colega (a existente, se houver) ou cria um
 * grupo com colegas. Quem cria entra como administração.
 */
export async function openConversation(actor: AuthenticatedActor, input: NewConversation): Promise<{ id: string }> {
  return withTenant(actor, async (tx) => {
    if (input.kind === "direct") {
      if (input.userId === actor.userId) throw badRequest("Escolha outra pessoa para conversar.");
      const directKey = directKeyOf(actor.userId, input.userId);
      const [existing] = await tx.select({ id: s.conversations.id }).from(s.conversations).where(eq(s.conversations.directKey, directKey));
      if (existing) return { id: existing.id };
      const colleagues = await activeColleaguesAmong(tx, actor, [input.userId]);
      if (!colleagues.has(input.userId)) throw notFound("Pessoa não encontrada.");
      // Sem RETURNING: a conversa só fica visível (RLS) depois que a pessoa entra nela.
      const id = randomUUID();
      await tx.insert(s.conversations).values({ id, tenantId: actor.tenantId, kind: "direct", directKey, createdBy: actor.userId });
      await tx.insert(s.conversationMembers).values({ tenantId: actor.tenantId, conversationId: id, userId: actor.userId, role: "admin" });
      await tx.insert(s.conversationMembers).values({ tenantId: actor.tenantId, conversationId: id, userId: input.userId, role: "member" });
      return { id };
    }

    const ids = input.memberIds.filter((m) => m !== actor.userId);
    if (ids.length === 0) throw badRequest("Escolha ao menos uma pessoa.");
    const eligible = await activeColleaguesAmong(tx, actor, ids);
    if (eligible.size !== ids.length) throw badRequest("Só é possível adicionar colaboradores ativos da empresa ao grupo.");
    const id = randomUUID();
    await tx.insert(s.conversations).values({ id, tenantId: actor.tenantId, kind: "group", title: input.title, createdBy: actor.userId });
    await tx.insert(s.conversationMembers).values({ tenantId: actor.tenantId, conversationId: id, userId: actor.userId, role: "admin" });
    await tx.insert(s.conversationMembers).values(ids.map((userId) => ({ tenantId: actor.tenantId, conversationId: id, userId, role: "member" as const })));
    return { id };
  });
}

async function requireGroupAdmin(tx: Tx, actor: AuthenticatedActor, conversationId: string) {
  const me = await membership(tx, actor, conversationId);
  if (me.kind !== "group") throw badRequest("Conversas privadas não têm administração.");
  if (me.role !== "admin") throw forbidden("Só quem administra o grupo pode fazer isso.");
  return me;
}

export async function renameGroup(actor: AuthenticatedActor, conversationId: string, title: string) {
  await withTenant(actor, async (tx) => {
    await requireGroupAdmin(tx, actor, conversationId);
    await tx.update(s.conversations).set({ title, updatedAt: new Date() }).where(eq(s.conversations.id, conversationId));
  });
}

/** Adiciona colegas ao grupo (administração) (quem já saiu volta, sem ver as mensagens anteriores). */
export async function addMembers(actor: AuthenticatedActor, conversationId: string, userIds: string[]) {
  await withTenant(actor, async (tx) => {
    await requireGroupAdmin(tx, actor, conversationId);
    const ids = userIds.filter((id) => id !== actor.userId);
    const eligible = await activeColleaguesAmong(tx, actor, ids);
    if (eligible.size !== ids.length) throw badRequest("Só é possível adicionar colaboradores ativos da empresa ao grupo.");
    const current = await tx
      .select({ userId: s.conversationMembers.userId, leftAt: s.conversationMembers.leftAt })
      .from(s.conversationMembers)
      .where(eq(s.conversationMembers.conversationId, conversationId));
    const active = new Set(current.filter((m) => !m.leftAt).map((m) => m.userId));
    const fresh = ids.filter((id) => !active.has(id));
    if (active.size + fresh.length > GROUP_MAX_MEMBERS) throw badRequest(`Um grupo tem no máximo ${GROUP_MAX_MEMBERS} pessoas.`);
    const returning = fresh.filter((id) => current.some((m) => m.userId === id));
    const newcomers = fresh.filter((id) => !current.some((m) => m.userId === id));
    if (returning.length) {
      await tx
        .update(s.conversationMembers)
        .set({ leftAt: null, joinedAt: sql`now()`, role: "member", lastReadAt: null, typingAt: null })
        .where(and(eq(s.conversationMembers.conversationId, conversationId), inArray(s.conversationMembers.userId, returning)));
    }
    if (newcomers.length) {
      await tx.insert(s.conversationMembers).values(newcomers.map((userId) => ({ tenantId: actor.tenantId, conversationId, userId, role: "member" as const })));
    }
  });
}

/**
 * Remove alguém do grupo (administração) ou sai dele (`userId` = a própria
 * pessoa). Se a última administração sai, quem está há mais tempo assume.
 */
export async function removeMember(actor: AuthenticatedActor, conversationId: string, userId: string) {
  await withTenant(actor, async (tx) => {
    const me = await membership(tx, actor, conversationId);
    if (me.kind !== "group") throw badRequest("Conversas privadas não podem ser deixadas.");
    if (userId !== actor.userId && me.role !== "admin") throw forbidden("Só quem administra o grupo pode remover pessoas.");
    const others = await tx
      .select({ userId: s.conversationMembers.userId, role: s.conversationMembers.role })
      .from(s.conversationMembers)
      .where(and(eq(s.conversationMembers.conversationId, conversationId), isNull(s.conversationMembers.leftAt), ne(s.conversationMembers.userId, actor.userId)))
      .orderBy(asc(s.conversationMembers.joinedAt));
    if (userId === actor.userId) {
      if (me.role === "admin" && others.length > 0 && !others.some((o) => o.role === "admin")) {
        await tx
          .update(s.conversationMembers)
          .set({ role: "admin" })
          .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, others[0]!.userId)));
      }
    } else if (!others.some((o) => o.userId === userId)) {
      throw notFound("Esta pessoa não está no grupo.");
    }
    await tx
      .update(s.conversationMembers)
      .set({ leftAt: sql`now()`, typingAt: null })
      .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, userId)));
  });
}

const messageColumns = {
  id: s.chatMessages.id,
  senderId: s.chatMessages.senderId,
  senderName: displayName,
  senderImage: s.users.image,
  body: s.chatMessages.body,
  createdAt: s.chatMessages.createdAt,
  deletedAt: s.chatMessages.deletedAt,
  editedAt: s.chatMessages.editedAt,
  /** Quem curtiu (nome atual), na ordem das curtidas — só curtidas que a pessoa vê (RLS). */
  likers: sql<{ id: string; name: string }[]>`coalesce((
    select json_agg(json_build_object('id', lu.id, 'name', coalesce(nullif(lp.preferred_name, ''), lu.name)) order by l.created_at)
    from chat_message_likes l join users lu on lu.id = l.user_id left join employee_profiles lp on lp.user_id = lu.id
    where l.tenant_id = chat_messages.tenant_id and l.message_id = chat_messages.id), '[]'::json)`,
  fileId: s.files.id,
  fileName: s.files.originalName,
  fileMime: s.files.mimeType,
  fileSize: s.files.sizeBytes,
};

function messagesQuery(tx: Tx) {
  return tx
    .select(messageColumns)
    .from(s.chatMessages)
    .innerJoin(s.users, eq(s.users.id, s.chatMessages.senderId))
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .leftJoin(s.files, eq(s.files.id, s.chatMessages.fileId))
    .$dynamic();
}

type MessageRow = Awaited<ReturnType<ReturnType<typeof messagesQuery>["execute"]>>[number];

function toFile(id: string | null, name: string | null, mimeType: string | null, sizeBytes: number | null): ChatFile | null {
  return id && name && mimeType ? { id, url: fileUrl(id), name, mimeType, sizeBytes: sizeBytes ?? 0 } : null;
}

function toMessage(actor: AuthenticatedActor, r: MessageRow): ChatMessage {
  const deleted = Boolean(r.deletedAt);
  return {
    id: r.id,
    senderId: r.senderId,
    senderName: r.senderName,
    senderImage: r.senderImage,
    mine: r.senderId === actor.userId,
    body: deleted ? "" : r.body,
    file: deleted ? null : toFile(r.fileId, r.fileName, r.fileMime, r.fileSize),
    at: r.createdAt.toISOString(),
    deleted,
    edited: !deleted && r.editedAt !== null,
    likes: deleted ? 0 : r.likers.length,
    likedByMe: !deleted && r.likers.some((l) => l.id === actor.userId),
    likedBy: deleted ? [] : r.likers.map((l) => l.name),
  };
}

/**
 * Mensagens: a página mais recente (ou anterior a `before`), ou as novidades
 * desde `after` (inclui as editadas, apagadas e curtidas nesse intervalo). Junto: até quando as
 * outras pessoas leram, quem está digitando e quem está online.
 */
export async function listMessages(actor: AuthenticatedActor, conversationId: string, query: MessagesQuery): Promise<MessagesPage> {
  return withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    const inConversation = eq(s.chatMessages.conversationId, conversationId);
    let items: MessageRow[];
    let hasMore = false;
    if (query.after) {
      const since = new Date(new Date(query.after).getTime() - OVERLAP_MS);
      items = await messagesQuery(tx)
        .where(and(inConversation, or(gt(s.chatMessages.createdAt, since), gt(s.chatMessages.updatedAt, since))))
        .orderBy(asc(s.chatMessages.createdAt), asc(s.chatMessages.id))
        .limit(200);
    } else {
      const rows = await messagesQuery(tx)
        .where(and(inConversation, query.before ? lt(s.chatMessages.createdAt, new Date(query.before)) : undefined))
        .orderBy(desc(s.chatMessages.createdAt), desc(s.chatMessages.id))
        .limit(PAGE + 1);
      hasMore = rows.length > PAGE;
      items = rows.slice(0, PAGE).reverse();
    }

    const others = await tx
      .select({
        userId: s.conversationMembers.userId,
        name: displayName,
        lastReadAt: s.conversationMembers.lastReadAt,
        typing: sql<boolean>`coalesce(${s.conversationMembers.typingAt} > now() - ${TYPING_WINDOW}, false)`,
        online: sql<boolean>`exists (select 1 from user_presence p where p.user_id = ${s.conversationMembers.userId} and p.last_seen_at > now() - ${ONLINE_WINDOW})`,
      })
      .from(s.conversationMembers)
      .innerJoin(s.users, eq(s.users.id, s.conversationMembers.userId))
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(and(eq(s.conversationMembers.conversationId, conversationId), isNull(s.conversationMembers.leftAt), ne(s.conversationMembers.userId, actor.userId)));
    const reads = others.map((o) => o.lastReadAt?.getTime() ?? 0);
    const minRead = reads.length ? Math.min(...reads) : 0;

    return {
      items: items.map((r) => toMessage(actor, r)),
      hasMore,
      othersReadAt: minRead > 0 ? new Date(minRead).toISOString() : null,
      typing: others.filter((o) => o.typing).map((o) => o.name.split(/\s+/)[0] ?? o.name),
      online: others.filter((o) => o.online).map((o) => o.userId),
      serverTime: new Date().toISOString(),
    };
  });
}

/** Envia uma mensagem (texto e/ou um anexo enviado antes com a finalidade `chat_attachment`). */
export async function sendMessage(actor: AuthenticatedActor, conversationId: string, input: SendMessage): Promise<ChatMessage> {
  return withTenant(actor, async (tx) => {
    const me = await membership(tx, actor, conversationId);
    if (me.kind === "direct") await assertCanSend(tx, actor, conversationId);
    if (input.fileId) {
      const [file] = await tx
        .select({ id: s.files.id })
        .from(s.files)
        .where(and(eq(s.files.id, input.fileId), eq(s.files.ownerUserId, actor.userId), eq(s.files.purpose, "chat_attachment"), isNull(s.files.deletedAt)));
      if (!file) throw badRequest("Anexo não encontrado. Envie o arquivo novamente.");
      const [used] = await tx.select({ id: s.chatMessages.id }).from(s.chatMessages).where(eq(s.chatMessages.fileId, input.fileId)).limit(1);
      if (used) throw badRequest("Este anexo já foi enviado. Envie o arquivo novamente.");
    }
    const id = randomUUID();
    await tx.insert(s.chatMessages).values({ id, tenantId: actor.tenantId, conversationId, senderId: actor.userId, body: input.body.trim(), fileId: input.fileId ?? null });
    await tx
      .update(s.conversationMembers)
      .set({ lastReadAt: sql`now()`, typingAt: null })
      .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, actor.userId)));
    const [row] = await messagesQuery(tx).where(eq(s.chatMessages.id, id));
    return toMessage(actor, row!);
  });
}

/** Corrige o texto de uma mensagem própria (o banco marca como editada). */
export async function editMessage(actor: AuthenticatedActor, conversationId: string, messageId: string, body: string): Promise<ChatMessage> {
  return withTenant(actor, async (tx) => {
    const me = await membership(tx, actor, conversationId);
    if (me.kind === "direct") await assertCanSend(tx, actor, conversationId);
    const [message] = await tx
      .select({ body: s.chatMessages.body, fileId: s.chatMessages.fileId })
      .from(s.chatMessages)
      .where(and(eq(s.chatMessages.id, messageId), eq(s.chatMessages.conversationId, conversationId), eq(s.chatMessages.senderId, actor.userId), isNull(s.chatMessages.deletedAt)));
    if (!message) throw notFound("Mensagem não encontrada.");
    const text = body.trim();
    if (!text && !message.fileId) throw badRequest("A mensagem não pode ficar vazia. Para tirá-la da conversa, apague a mensagem.");
    if (text !== message.body) await tx.update(s.chatMessages).set({ body: text }).where(eq(s.chatMessages.id, messageId));
    const [row] = await messagesQuery(tx).where(eq(s.chatMessages.id, messageId));
    return toMessage(actor, row!);
  });
}

/** Curte (ou desfaz a curtida de) uma mensagem que a pessoa vê, em nome próprio. */
export async function setMessageLike(actor: AuthenticatedActor, conversationId: string, messageId: string, liked: boolean): Promise<ChatMessage> {
  return withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    const [message] = await tx
      .select({ id: s.chatMessages.id })
      .from(s.chatMessages)
      .where(and(eq(s.chatMessages.id, messageId), eq(s.chatMessages.conversationId, conversationId), isNull(s.chatMessages.deletedAt)));
    if (!message) throw notFound("Mensagem não encontrada.");
    if (liked) {
      await tx.insert(s.chatMessageLikes).values({ tenantId: actor.tenantId, messageId, userId: actor.userId }).onConflictDoNothing();
    } else {
      await tx.delete(s.chatMessageLikes).where(and(eq(s.chatMessageLikes.messageId, messageId), eq(s.chatMessageLikes.userId, actor.userId)));
    }
    const [row] = await messagesQuery(tx).where(eq(s.chatMessages.id, messageId));
    return toMessage(actor, row!);
  });
}

/** Apaga uma mensagem própria: o texto e o anexo são descartados (o arquivo deixa de ser entregue). */
export async function deleteMessage(actor: AuthenticatedActor, conversationId: string, messageId: string) {
  await withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    const [message] = await tx
      .select({ fileId: s.chatMessages.fileId })
      .from(s.chatMessages)
      .where(and(eq(s.chatMessages.id, messageId), eq(s.chatMessages.conversationId, conversationId), eq(s.chatMessages.senderId, actor.userId), isNull(s.chatMessages.deletedAt)));
    if (!message) throw notFound("Mensagem não encontrada.");
    await tx.update(s.chatMessages).set({ deletedAt: sql`now()`, body: "", fileId: null }).where(eq(s.chatMessages.id, messageId));
    if (message.fileId) await tx.update(s.files).set({ deletedAt: new Date() }).where(eq(s.files.id, message.fileId));
  });
}

/** Marca a conversa como lida até agora. */
export async function markConversationRead(actor: AuthenticatedActor, conversationId: string) {
  await withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    await tx
      .update(s.conversationMembers)
      .set({ lastReadAt: sql`now()` })
      .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, actor.userId)));
  });
}

/** Sinal de "digitando…" (vale por alguns segundos). */
export async function signalTyping(actor: AuthenticatedActor, conversationId: string) {
  await withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    await tx
      .update(s.conversationMembers)
      .set({ typingAt: sql`now()` })
      .where(and(eq(s.conversationMembers.conversationId, conversationId), eq(s.conversationMembers.userId, actor.userId)));
  });
}

const LINK = /https:\/\/[^\s<>"']+/g;

/** Fotos, arquivos e links compartilhados na conversa (os mais recentes primeiro). */
export async function listSharedMedia(actor: AuthenticatedActor, conversationId: string): Promise<SharedMedia> {
  return withTenant(actor, async (tx) => {
    await membership(tx, actor, conversationId);
    const files = await tx
      .select({ id: s.files.id, name: s.files.originalName, mimeType: s.files.mimeType, sizeBytes: s.files.sizeBytes, at: s.chatMessages.createdAt })
      .from(s.chatMessages)
      .innerJoin(s.files, eq(s.files.id, s.chatMessages.fileId))
      .where(and(eq(s.chatMessages.conversationId, conversationId), isNull(s.chatMessages.deletedAt)))
      .orderBy(desc(s.chatMessages.createdAt))
      .limit(60);
    const withLinks = await tx
      .select({ id: s.chatMessages.id, body: s.chatMessages.body, at: s.chatMessages.createdAt })
      .from(s.chatMessages)
      .where(and(eq(s.chatMessages.conversationId, conversationId), isNull(s.chatMessages.deletedAt), sql`${s.chatMessages.body} like '%https://%'`))
      .orderBy(desc(s.chatMessages.createdAt))
      .limit(60);
    const view = (f: (typeof files)[number]) => ({ ...toFile(f.id, f.name, f.mimeType, f.sizeBytes)!, at: f.at.toISOString() });
    return {
      images: files.filter((f) => f.mimeType.startsWith("image/")).map(view),
      files: files.filter((f) => !f.mimeType.startsWith("image/")).map(view),
      links: withLinks.flatMap((m) => [...m.body.matchAll(LINK)].map((match) => ({ url: match[0].replace(/[.,;:!?)]+$/, ""), at: m.at.toISOString(), messageId: m.id }))).slice(0, 60),
    };
  });
}

/** Contadores do menu: "Conversas" (conversas com mensagens não lidas) e "Amigos" (pedidos de conexão recebidos). */
export async function friendsBadgeCount(actor: AuthenticatedActor): Promise<{ conversations: number; requests: number }> {
  return withTenant(actor, async (tx) => {
    const result = await tx.execute(sql`
      select count(*)::int as n from conversation_members m
      where m.user_id = ${actor.userId} and m.left_at is null
        and exists (
          select 1 from chat_messages u
          where u.conversation_id = m.conversation_id and u.sender_id <> ${actor.userId} and u.deleted_at is null
            and (m.last_read_at is null or u.created_at > m.last_read_at)
        )
    `);
    const unread = (result as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
    return { conversations: unread, requests: await countReceivedRequests(tx, actor) };
  });
}

/** Sinal de presença ("online agora"); grava no máximo a cada 30 s. */
export async function touchPresence(actor: AuthenticatedActor) {
  await withTenant(actor, async (tx) => {
    await tx
      .insert(s.userPresence)
      .values({ tenantId: actor.tenantId, userId: actor.userId })
      .onConflictDoUpdate({
        target: [s.userPresence.tenantId, s.userPresence.userId],
        set: { lastSeenAt: sql`now()` },
        setWhere: sql`${s.userPresence.lastSeenAt} < now() - interval '30 seconds'`,
      });
  });
}

