import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, updatedAt } from "./_columns";
import { users } from "./auth";
import { files } from "./files";
import { organizations } from "./tenancy";

/**
 * Amigos e conversas (área "Amigos" do colaborador).
 *
 *  - `friendships`: um vínculo por par de pessoas. Pedido = `pending`;
 *    aceito = `accepted`. Recusar, cancelar e desfazer a amizade apagam a linha.
 *    Pedidos só são vistos pelas duas pessoas; amizades aceitas são visíveis
 *    na empresa (amigos em comum).
 *  - `conversations` + `conversation_members` + `chat_messages`: conversas
 *    privadas (1:1) e em grupo. Só quem participa lê as mensagens, e só as
 *    enviadas a partir da própria entrada no grupo. Nem a gestão nem
 *    administradores leem conversas (RLS + funções `app.chat_*`).
 *  - `user_presence`: "online agora" (último sinal de atividade).
 */

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

export const friendships = pgTable(
  "friendships",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    requesterId: uuid("requester_id").notNull(),
    addresseeId: uuid("addressee_id").notNull(),
    status: text("status", { enum: FRIENDSHIP_STATUSES }).notNull().default("pending"),
    createdAt: createdAt(),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    foreignKey({ name: "friendships_requester_fk", columns: [t.tenantId, t.requesterId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "friendships_addressee_fk", columns: [t.tenantId, t.addresseeId], foreignColumns: [users.tenantId, users.id] }),
    // Um vínculo por par, independentemente de quem pediu.
    uniqueIndex("friendships_pair_key").on(t.tenantId, sql`least(${t.requesterId}, ${t.addresseeId})`, sql`greatest(${t.requesterId}, ${t.addresseeId})`),
    index("friendships_requester_idx").on(t.tenantId, t.requesterId, t.status),
    index("friendships_addressee_idx").on(t.tenantId, t.addresseeId, t.status),
    check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
    check("friendships_status_known", sql`${t.status} in ('pending', 'accepted')`),
    check("friendships_responded", sql`(${t.status} = 'accepted') = (${t.respondedAt} is not null)`),
  ],
);

export const CONVERSATION_KINDS = ["direct", "group"] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];
export const GROUP_TITLE_MAX = 60;

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    kind: text("kind", { enum: CONVERSATION_KINDS }).notNull(),
    /** Nome do grupo (conversas privadas não têm nome). */
    title: text("title"),
    /** Conversa privada: "<menor id>:<maior id>" — uma única conversa por par. */
    directKey: text("direct_key"),
    createdBy: uuid("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("conversations_tenant_id_id_key").on(t.tenantId, t.id),
    unique("conversations_direct_key").on(t.tenantId, t.directKey),
    foreignKey({ name: "conversations_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    check("conversations_kind_known", sql`${t.kind} in ('direct', 'group')`),
    check(
      "conversations_kind_shape",
      sql`(${t.kind} = 'direct' and ${t.directKey} is not null and ${t.title} is null) or (${t.kind} = 'group' and ${t.directKey} is null and char_length(btrim(${t.title})) between 1 and ${sql.raw(String(GROUP_TITLE_MAX))})`,
    ),
  ],
);

export const CONVERSATION_ROLES = ["admin", "member"] as const;
export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export const conversationMembers = pgTable(
  "conversation_members",
  {
    tenantId: tenantId().references(() => organizations.id),
    conversationId: uuid("conversation_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role", { enum: CONVERSATION_ROLES }).notNull().default("member"),
    /** Entrada (ou reentrada) no grupo: mensagens anteriores não ficam visíveis. */
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Saiu ou foi removida: perde o acesso à conversa. */
    leftAt: timestamp("left_at", { withTimezone: true, mode: "date" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }),
    /** Último sinal de "digitando…". */
    typingAt: timestamp("typing_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    primaryKey({ name: "conversation_members_pk", columns: [t.tenantId, t.conversationId, t.userId] }),
    foreignKey({ name: "conversation_members_conversation_fk", columns: [t.tenantId, t.conversationId], foreignColumns: [conversations.tenantId, conversations.id] }).onDelete("cascade"),
    foreignKey({ name: "conversation_members_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    index("conversation_members_user_idx").on(t.tenantId, t.userId),
    check("conversation_members_role_known", sql`${t.role} in ('admin', 'member')`),
  ],
);

export const MESSAGE_MAX = 4000;

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    conversationId: uuid("conversation_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    body: text("body").notNull().default(""),
    /** Anexo (arquivo privado com finalidade `chat_attachment`). */
    fileId: uuid("file_id"),
    createdAt: createdAt(),
    /** Apagada por quem enviou: texto e anexo são descartados. */
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    /** Texto corrigido por quem enviou (definido pelo trigger do banco). */
    editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }),
    /** Última mudança (edição, exclusão ou curtida): base da atualização periódica. */
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique("chat_messages_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "chat_messages_conversation_fk", columns: [t.tenantId, t.conversationId], foreignColumns: [conversations.tenantId, conversations.id] }).onDelete("cascade"),
    foreignKey({ name: "chat_messages_sender_fk", columns: [t.tenantId, t.senderId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "chat_messages_file_fk", columns: [t.tenantId, t.fileId], foreignColumns: [files.tenantId, files.id] }),
    index("chat_messages_conversation_idx").on(t.tenantId, t.conversationId, t.createdAt.desc()),
    check(
      "chat_messages_content",
      sql`(${t.deletedAt} is not null and ${t.body} = '' and ${t.fileId} is null) or (${t.deletedAt} is null and char_length(${t.body}) <= ${sql.raw(String(MESSAGE_MAX))} and (char_length(btrim(${t.body})) > 0 or ${t.fileId} is not null))`,
    ),
  ],
);

/** Curtida em mensagem: uma por pessoa e mensagem, em nome próprio. */
export const chatMessageLikes = pgTable(
  "chat_message_likes",
  {
    tenantId: tenantId().references(() => organizations.id),
    messageId: uuid("message_id").notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "chat_message_likes_pk", columns: [t.tenantId, t.messageId, t.userId] }),
    foreignKey({ name: "chat_message_likes_message_fk", columns: [t.tenantId, t.messageId], foreignColumns: [chatMessages.tenantId, chatMessages.id] }).onDelete("cascade"),
    foreignKey({ name: "chat_message_likes_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
  ],
);

export const userPresence = pgTable(
  "user_presence",
  {
    tenantId: tenantId().references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "user_presence_pk", columns: [t.tenantId, t.userId] }),
    foreignKey({ name: "user_presence_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
  ],
);

/** Interesses do perfil (catálogo em src/lib/interests.ts). Visíveis na empresa; cada pessoa edita os seus. */
export const userInterests = pgTable(
  "user_interests",
  {
    tenantId: tenantId().references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    interestKey: text("interest_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "user_interests_pk", columns: [t.tenantId, t.userId, t.interestKey] }),
    foreignKey({ name: "user_interests_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    index("user_interests_key_idx").on(t.tenantId, t.interestKey),
    check("user_interests_key_format", sql`${t.interestKey} ~ '^[a-z][a-z-]{1,31}$'`),
  ],
);

/**
 * @deprecated "Seguir" passou a ser o próprio pedido de conexão (out/2026): a
 * tabela não é mais usada. Remover numa migration da PRÓXIMA release
 * (expand/contract), depois que esta versão estiver no ar.
 */
export const userFollows = pgTable(
  "user_follows",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    followerId: uuid("follower_id").notNull(),
    followeeId: uuid("followee_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("user_follows_pair_key").on(t.tenantId, t.followerId, t.followeeId),
    foreignKey({ name: "user_follows_follower_fk", columns: [t.tenantId, t.followerId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "user_follows_followee_fk", columns: [t.tenantId, t.followeeId], foreignColumns: [users.tenantId, users.id] }),
    index("user_follows_followee_idx").on(t.tenantId, t.followeeId),
    check("user_follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
  ],
);

/** Sugestões de conexão dispensadas (o "x" do cartão). Estritamente pessoal. */
export const connectionSuggestionDismissals = pgTable(
  "connection_suggestion_dismissals",
  {
    tenantId: tenantId().references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    dismissedUserId: uuid("dismissed_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "connection_suggestion_dismissals_pk", columns: [t.tenantId, t.userId, t.dismissedUserId] }),
    foreignKey({ name: "connection_suggestion_dismissals_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "connection_suggestion_dismissals_dismissed_fk", columns: [t.tenantId, t.dismissedUserId], foreignColumns: [users.tenantId, users.id] }),
  ],
);
