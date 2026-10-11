import { defineRoute } from "@/server/http/route";
import { notificationKeysSchema } from "@/server/modules/notifications/schemas";
import { markNotifications } from "@/server/modules/notifications/service";

/** Marca notificações da própria pessoa como lidas (ou não lidas, com `read: false`). */
export const POST = defineRoute({
  permission: "authenticated",
  body: notificationKeysSchema,
  handler: ({ actor, body }) => markNotifications(actor, body.keys, body.read),
});
