import { z } from "zod";
import { EVENT_KINDS, EVENT_MODES, QUICK_LINK_COLORS, QUICK_LINK_ICONS } from "@/server/db/schema/communication";
import { ctaUrlSchema } from "@/server/modules/banners/schemas";

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`).nullish().transform((v) => v || null);
const dateTime = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

export const eventInputSchema = z
  .strictObject({
    title: z.string().trim().min(1, "Campo obrigatório.").max(120, "Use no máximo 120 caracteres."),
    description: optionalText(2000),
    kind: z.enum(EVENT_KINDS),
    mode: z.enum(EVENT_MODES),
    location: optionalText(120),
    url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => /^https:\/\/[^\s]+$/i.test(v), "Use um endereço https://.")
      .nullish()
      .transform((v) => v || null),
    startsAt: dateTime,
    endsAt: dateTime.nullish().transform((v) => v ?? null),
    published: z.boolean().default(false),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, { message: "O fim precisa ser depois do início.", path: ["endsAt"] })
  .refine((e) => e.mode === "online" || Boolean(e.location), { message: "Informe o local do evento.", path: ["location"] });
export type EventInput = z.infer<typeof eventInputSchema>;

export const quickLinkInputSchema = z.strictObject({
  label: z.string().trim().min(1, "Campo obrigatório.").max(24, "Use no máximo 24 caracteres."),
  url: ctaUrlSchema,
  icon: z.enum(QUICK_LINK_ICONS),
  color: z.enum(QUICK_LINK_COLORS),
  active: z.boolean().default(true),
});
export type QuickLinkInput = z.infer<typeof quickLinkInputSchema>;

export const idParamsSchema = z.strictObject({ id: z.uuid() });
export const orderSchema = z.strictObject({ ids: z.array(z.uuid()).min(1).max(50) });
