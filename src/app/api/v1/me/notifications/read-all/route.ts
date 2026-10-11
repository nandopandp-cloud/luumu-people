import { defineRoute } from "@/server/http/route";
import { markAllNotificationsRead } from "@/server/modules/notifications/service";

export const POST = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => markAllNotificationsRead(actor),
});
