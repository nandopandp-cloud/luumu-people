import { z } from "zod";
import { ANNOUNCEMENT_CATEGORIES, ILLUSTRATIONS, THEMES } from "@/server/db/schema/learning";

const text = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max, `Use no máximo ${max} caracteres.`);

export const announcementInputSchema = z.strictObject({
  title: text(120),
  summary: text(240),
  body: z.string().trim().max(10_000, "Use no máximo 10.000 caracteres.").nullish(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  theme: z.enum(THEMES),
  illustration: z.enum(ILLUSTRATIONS),
  pinned: z.boolean().default(false),
  coverFileId: z.uuid().nullish().transform((v) => v ?? null),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

/** Publicar agora (sem data) ou agendar (data futura, até 1 ano). */
export const publishInputSchema = z.strictObject({
  publishAt: z.iso.datetime({ offset: true }).nullish(),
});

export const announcementParamsSchema = z.strictObject({ id: z.uuid() });

export const MANAGED_FILTERS = ["todos", "rascunhos", "agendados", "publicados", "arquivados"] as const;
export type ManagedFilter = (typeof MANAGED_FILTERS)[number];
