import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId } from "./_columns";
import { users } from "./auth";
import { organizations } from "./tenancy";

export const FILE_PURPOSE_VALUES = ["avatar", "course_cover", "announcement_cover", "lesson_material", "library_material", "home_banner"] as const;

/**
 * Arquivos enviados. O conteúdo fica em storage PRIVADO (Vercel Blob privado em
 * produção); a chave é gerada no servidor e nunca derivada do nome do arquivo.
 * Acesso somente via /api/v1/files/:id, que valida sessão, tenant e permissão.
 */
export const files = pgTable(
  "files",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    ownerUserId: uuid("owner_user_id").notNull(),
    purpose: text("purpose", { enum: FILE_PURPOSE_VALUES }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    unique("files_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "files_owner_fk", columns: [t.tenantId, t.ownerUserId], foreignColumns: [users.tenantId, users.id] }),
    index("files_tenant_owner_idx").on(t.tenantId, t.ownerUserId),
    check("files_size_positive", sql`${t.sizeBytes} > 0`),
    check("files_mime_allowed", sql`${t.mimeType} in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')`),
  ],
);
