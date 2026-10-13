import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId } from "./_columns";
import { users } from "./auth";
import { announcementComments } from "./communication";
import { announcements } from "./learning";
import { organizations } from "./tenancy";

/**
 * Notificações in-app. Amizade (pedido recebido e pedido aceito) também é
 * CALCULADA, a partir de `friendships` (chaves `friend:<id>` e `friendok:<id>`).
 *
 * Dois tipos de origem:
 *  - CALCULADAS na leitura (novo comunicado, nova pesquisa, lembrete de
 *    pesquisa): vêm das próprias tabelas de origem, então respeitam sempre o
 *    público e o estado atual (arquivado some). Só a leitura é gravada, em
 *    `notification_reads`, pela chave do item (`announcement:<id>`…).
 *  - GRAVADAS para quem recebe (menção, resposta, curtida em comentário), em
 *    `notifications`. A leitura volta a conferir se a pessoa ainda vê o comunicado.
 *
 * Nenhuma notificação envolve resposta de pesquisa (docs/anonymous-surveys.md):
 * as de pesquisa usam só o convite da própria pessoa.
 */

export const NOTIFICATION_TYPES = ["mention", "comment_reply", "comment_like"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Interações entre pessoas, uma linha por destinatário. */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    recipientId: uuid("recipient_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
    announcementId: uuid("announcement_id").notNull(),
    /** Menção/resposta: o comentário novo. Curtida: o comentário curtido (de quem recebe). */
    commentId: uuid("comment_id").notNull(),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    foreignKey({ name: "notifications_recipient_fk", columns: [t.tenantId, t.recipientId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "notifications_actor_fk", columns: [t.tenantId, t.actorId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "notifications_announcement_fk", columns: [t.tenantId, t.announcementId], foreignColumns: [announcements.tenantId, announcements.id] }).onDelete("cascade"),
    foreignKey({ name: "notifications_comment_fk", columns: [t.tenantId, t.commentId], foreignColumns: [announcementComments.tenantId, announcementComments.id] }).onDelete("cascade"),
    // Idempotente: a mesma pessoa não gera duas notificações iguais (ex.: curtir de novo).
    unique("notifications_once_key").on(t.recipientId, t.type, t.commentId, t.actorId),
    index("notifications_inbox_idx").on(t.tenantId, t.recipientId, t.createdAt.desc()),
    check("notifications_not_self", sql`${t.recipientId} <> ${t.actorId}`),
  ],
);

/** Leitura das notificações calculadas (chave do item). */
export const notificationReads = pgTable(
  "notification_reads",
  {
    tenantId: tenantId().references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    key: text("key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "notification_reads_pk", columns: [t.tenantId, t.userId, t.key] }),
    foreignKey({ name: "notification_reads_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    check("notification_reads_key_format", sql`${t.key} ~ '^(announcement|survey|reminder|friend|friendok|follow):[0-9a-f-]{36}$'`),
  ],
);

/** Categorias que a pessoa pode silenciar (preferências). */
export const NOTIFICATION_CATEGORIES = ["surveys", "reminders", "announcements", "mentions", "comments", "likes", "friends"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    tenantId: tenantId().references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    muted: text("muted").array().notNull().default(sql`'{}'::text[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "notification_preferences_pk", columns: [t.tenantId, t.userId] }),
    foreignKey({ name: "notification_preferences_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    check("notification_preferences_muted_known", sql`${t.muted} <@ array['surveys', 'reminders', 'announcements', 'mentions', 'comments', 'likes', 'friends']::text[]`),
  ],
);
