import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { id, timestamps } from "./_columns";

export const ORGANIZATION_STATUSES = ["active", "suspended"] as const;

/** Valores permitidos de k-anonimato. O piso 5 também é garantido por CHECK no banco. */
export const ANONYMITY_K_VALUES = [5, 7, 10] as const;

/** Tenant. Toda informação de uma empresa pertence a exatamente uma organization. */
export const organizations = pgTable(
  "organizations",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    status: text("status", { enum: ORGANIZATION_STATUSES }).notNull().default("active"),
    anonymityK: integer("anonymity_k").notNull().default(5),
    settings: jsonb("settings").$type<OrganizationSettings>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [
    check("organizations_anonymity_k_check", sql`${t.anonymityK} in (5, 7, 10)`),
    check("organizations_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export type OrganizationSettings = {
  /** Ranking de conquistas entre colegas. Desligado por padrão. */
  achievementsRankingEnabled?: boolean;
  /** Tempo máximo de sessão ociosa em horas (sobrepõe o padrão da plataforma). */
  sessionIdleHours?: number;
};
