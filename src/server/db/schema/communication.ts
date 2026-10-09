import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { files } from "./files";
import { announcements } from "./learning";
import { organizations } from "./tenancy";

/**
 * Comunicação (mural de comunicados): curtidas, comentários, anexos, agenda de
 * eventos e links rápidos. Tudo isolado por tenant (RLS); quem vê cada
 * comunicado (público por área) é decidido no serviço.
 */

/** Curtida: uma por pessoa e comunicado. */
export const announcementReactions = pgTable(
  "announcement_reactions",
  {
    tenantId: tenantId().references(() => organizations.id),
    announcementId: uuid("announcement_id").notNull(),
    userId: uuid("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "announcement_reactions_pk", columns: [t.tenantId, t.announcementId, t.userId] }),
    foreignKey({ name: "announcement_reactions_announcement_fk", columns: [t.tenantId, t.announcementId], foreignColumns: [announcements.tenantId, announcements.id] }).onDelete("cascade"),
    foreignKey({ name: "announcement_reactions_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
  ],
);

/** Comentário. Removido = `deleted_at` (pelo autor ou por moderação); o texto some do mural. */
export const announcementComments = pgTable(
  "announcement_comments",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    announcementId: uuid("announcement_id").notNull(),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    deletedBy: uuid("deleted_by"),
  },
  (t) => [
    foreignKey({ name: "announcement_comments_announcement_fk", columns: [t.tenantId, t.announcementId], foreignColumns: [announcements.tenantId, announcements.id] }).onDelete("cascade"),
    foreignKey({ name: "announcement_comments_author_fk", columns: [t.tenantId, t.authorId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "announcement_comments_deleted_by_fk", columns: [t.tenantId, t.deletedBy], foreignColumns: [users.tenantId, users.id] }),
    index("announcement_comments_feed_idx").on(t.tenantId, t.announcementId, t.createdAt),
    check("announcement_comments_body_len", sql`char_length(${t.body}) between 1 and 1000`),
    check("announcement_comments_deleted_pair", sql`(${t.deletedAt} is null) = (${t.deletedBy} is null)`),
  ],
);

export const ATTACHMENT_KINDS = ["file", "video"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

/** Anexo: arquivo privado (PDF/imagem) ou vídeo do YouTube/Vimeo (só link, nunca upload). */
export const announcementAttachments = pgTable(
  "announcement_attachments",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    announcementId: uuid("announcement_id").notNull(),
    kind: text("kind", { enum: ATTACHMENT_KINDS }).notNull(),
    title: text("title").notNull(),
    fileId: uuid("file_id"),
    videoUrl: text("video_url"),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "announcement_attachments_announcement_fk", columns: [t.tenantId, t.announcementId], foreignColumns: [announcements.tenantId, announcements.id] }).onDelete("cascade"),
    foreignKey({ name: "announcement_attachments_file_fk", columns: [t.tenantId, t.fileId], foreignColumns: [files.tenantId, files.id] }),
    index("announcement_attachments_announcement_idx").on(t.tenantId, t.announcementId, t.position),
    check("announcement_attachments_kind", sql`(${t.kind} = 'file' and ${t.fileId} is not null and ${t.videoUrl} is null) or (${t.kind} = 'video' and ${t.videoUrl} is not null and ${t.fileId} is null)`),
    check("announcement_attachments_video_https", sql`${t.videoUrl} is null or ${t.videoUrl} like 'https://%'`),
  ],
);

export const EVENT_KINDS = ["evento", "treinamento", "workshop", "palestra", "celebracao"] as const;
export const EVENT_MODES = ["online", "presencial", "hibrido"] as const;

/** Agenda de eventos da empresa (mural de comunicados). */
export const events = pgTable(
  "events",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: EVENT_KINDS }).notNull().default("evento"),
    mode: text("mode", { enum: EVENT_MODES }).notNull().default("online"),
    /** Local (ex.: "Sede", "Auditório"). */
    location: text("location"),
    /** Link de acesso/inscrição (https). */
    url: text("url"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    published: boolean("published").notNull().default(false),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "events_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    index("events_upcoming_idx").on(t.tenantId, t.published, t.startsAt),
    check("events_period", sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
    check("events_url_https", sql`${t.url} is null or ${t.url} like 'https://%'`),
  ],
);

export const QUICK_LINK_ICONS = ["gift", "file", "headset", "calendar", "heart", "book", "wallet", "shield", "users", "help", "link", "megaphone"] as const;
export const QUICK_LINK_COLORS = ["purple", "blue", "green", "orange", "pink", "yellow"] as const;

/** Atalhos do mural (Benefícios, Políticas, Canais de ajuda…). */
export const quickLinks = pgTable(
  "quick_links",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    label: text("label").notNull(),
    /** Caminho interno ("/comunicados") ou URL https. */
    url: text("url").notNull(),
    icon: text("icon", { enum: QUICK_LINK_ICONS }).notNull().default("link"),
    color: text("color", { enum: QUICK_LINK_COLORS }).notNull().default("purple"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "quick_links_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    index("quick_links_tenant_position_idx").on(t.tenantId, t.position),
    check("quick_links_url_safe", sql`${t.url} ~ '^/[a-z0-9]' or ${t.url} like 'https://%'`),
  ],
);
