import { z } from "zod";
import { NOTIFICATION_CATEGORIES } from "@/server/db/schema/notifications";
import { NOTIFICATION_TABS } from "./service";

const KEY = /^(?:(?:announcement|survey|reminder|n|like):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

export const notificationsQuerySchema = z.strictObject({
  aba: z.enum(NOTIFICATION_TABS).default("todas"),
  /** Categorias separadas por vírgula (filtro da lista). */
  tipos: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v ? v.split(",").filter((c): c is (typeof NOTIFICATION_CATEGORIES)[number] => (NOTIFICATION_CATEGORIES as readonly string[]).includes(c)) : undefined)),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

export const notificationKeysSchema = z.strictObject({
  keys: z.array(z.string().regex(KEY, "Notificação inválida.")).min(1).max(200),
  read: z.boolean().default(true),
});

export const notificationPreferencesSchema = z.strictObject({
  muted: z.array(z.enum(NOTIFICATION_CATEGORIES)).max(NOTIFICATION_CATEGORIES.length),
});
