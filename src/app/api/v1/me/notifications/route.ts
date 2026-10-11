import { defineRoute } from "@/server/http/route";
import { notificationsQuerySchema } from "@/server/modules/notifications/schemas";
import { listNotifications } from "@/server/modules/notifications/service";

/** Notificações da própria pessoa (sino e central). */
export const GET = defineRoute({
  permission: "authenticated",
  query: notificationsQuerySchema,
  handler: ({ actor, query }) => listNotifications(actor, { tab: query.aba, categories: query.tipos, limit: query.limite }),
});
