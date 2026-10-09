import { z } from "zod";
import { BANNER_LAYOUTS } from "@/server/db/schema/banners";
import { ILLUSTRATIONS, THEMES } from "@/server/db/schema/learning";

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).nullish().transform((v) => v || null);

/** Destino do botão: caminho interno ("/trilhas") ou URL https. Nada de javascript:, http: ou "//". */
export const ctaUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/[a-z0-9]/i.test(v) || /^https:\/\/[^\s]+$/i.test(v), "Use um caminho da plataforma (ex.: /trilhas) ou um endereço https://.");

const dateTime = z.iso.datetime({ offset: true }).nullish().transform((v) => (v ? new Date(v) : null));

export const bannerInputSchema = z
  .strictObject({
    layout: z.enum(BANNER_LAYOUTS).default("composed"),
    title: z.string().trim().min(1, "Campo obrigatório.").max(90, "Use no máximo 90 caracteres."),
    subtitle: optionalText(200),
    ctaLabel: optionalText(30),
    ctaUrl: ctaUrlSchema.nullish().transform((v) => v || null),
    theme: z.enum(THEMES),
    illustration: z.enum(ILLUSTRATIONS).nullish().transform((v) => v ?? null),
    imageFileId: z.uuid().nullish().transform((v) => v ?? null),
    active: z.boolean().default(false),
    startsAt: dateTime,
    endsAt: dateTime,
  })
  // Banner de imagem: sem botão (o link, se houver, é o banner inteiro) e sem textos sobrepostos.
  .transform((b) => (b.layout === "image" ? { ...b, subtitle: null, ctaLabel: null } : b))
  .refine((b) => b.layout === "image" || Boolean(b.ctaLabel) === Boolean(b.ctaUrl), { message: "Preencha o texto e o destino do botão (ou deixe os dois vazios).", path: ["ctaUrl"] })
  .refine((b) => b.layout !== "image" || Boolean(b.imageFileId), { message: "Envie a imagem do banner.", path: ["imageFileId"] })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { message: "O fim precisa ser depois do início.", path: ["endsAt"] });
export type BannerInput = z.infer<typeof bannerInputSchema>;

export const bannerParamsSchema = z.strictObject({ id: z.uuid() });
export const bannerOrderSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(50) });
