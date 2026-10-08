import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { files } from "./files";
import { ILLUSTRATIONS, THEMES } from "./learning";
import { organizations } from "./tenancy";

/**
 * Banners da página inicial do colaborador, gerenciados por quem publica
 * comunicados. Vários ativos ao mesmo tempo viram um carrossel (por `position`).
 * Sem banner ativo, a home mostra a boas-vindas padrão.
 */
export const homeBanners = pgTable(
  "home_banners",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    ctaLabel: text("cta_label"),
    /** Caminho interno ("/trilhas") ou URL https. */
    ctaUrl: text("cta_url"),
    theme: text("theme", { enum: THEMES }).notNull().default("purple"),
    /** Ilustração do design system; nula = sinalização da jornada (padrão da home). */
    illustration: text("illustration", { enum: ILLUSTRATIONS }),
    imageFileId: uuid("image_file_id"),
    active: boolean("active").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    position: integer("position").notNull().default(0),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "home_banners_image_fk", columns: [t.tenantId, t.imageFileId], foreignColumns: [files.tenantId, files.id] }),
    foreignKey({ name: "home_banners_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    index("home_banners_tenant_active_idx").on(t.tenantId, t.active, t.position),
    check("home_banners_cta_pair", sql`(${t.ctaLabel} is null) = (${t.ctaUrl} is null)`),
    check("home_banners_cta_url_safe", sql`${t.ctaUrl} is null or ${t.ctaUrl} ~ '^/[a-z0-9]' or ${t.ctaUrl} like 'https://%'`),
    check("home_banners_period", sql`${t.endsAt} is null or ${t.startsAt} is null or ${t.endsAt} > ${t.startsAt}`),
  ],
);
