import { z } from "zod";
import { ANNOUNCEMENT_CATEGORIES, ILLUSTRATIONS, THEMES } from "@/server/db/schema/learning";
import { toEmbedUrl } from "@/server/modules/courses/video";

const text = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max, `Use no máximo ${max} caracteres.`);

const attachmentTitle = z.string().trim().min(1, "Dê um nome ao anexo.").max(120, "Use no máximo 120 caracteres.");

/** Anexo: arquivo já enviado (finalidade announcement_attachment) ou vídeo do YouTube/Vimeo. */
export const attachmentInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("file"), title: attachmentTitle, fileId: z.uuid() }),
  z.strictObject({
    kind: z.literal("video"),
    title: attachmentTitle,
    videoUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => toEmbedUrl(v) !== null, "Use um link de vídeo do YouTube ou do Vimeo."),
  }),
]);
export type AttachmentInput = z.infer<typeof attachmentInputSchema>;

export const announcementInputSchema = z.strictObject({
  title: text(120),
  summary: text(240),
  body: z.string().trim().max(10_000, "Use no máximo 10.000 caracteres.").nullish(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  theme: z.enum(THEMES),
  illustration: z.enum(ILLUSTRATIONS),
  pinned: z.boolean().default(false),
  coverFileId: z.uuid().nullish().transform((v) => v ?? null),
  /** Nulo = empresa toda. */
  audienceOrgUnitId: z.uuid().nullish().transform((v) => v ?? null),
  attachments: z.array(attachmentInputSchema).max(10, "Use no máximo 10 anexos.").default([]),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

/** Publicar agora (sem data) ou agendar (data futura, até 1 ano). */
export const publishInputSchema = z.strictObject({
  publishAt: z.iso.datetime({ offset: true }).nullish(),
});

export const announcementParamsSchema = z.strictObject({ id: z.uuid() });

export const MANAGED_FILTERS = ["todos", "rascunhos", "agendados", "publicados", "arquivados"] as const;
export type ManagedFilter = (typeof MANAGED_FILTERS)[number];

export const commentInputSchema = z.strictObject({
  body: z.string().trim().min(1, "Escreva um comentário.").max(1000, "Use no máximo 1.000 caracteres."),
});
export const commentParamsSchema = z.strictObject({ id: z.uuid(), commentId: z.uuid() });
