import { defineRoute } from "@/server/http/route";
import { notificationPreferencesSchema } from "@/server/modules/notifications/schemas";
import { getNotificationPreferences, setNotificationPreferences } from "@/server/modules/notifications/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => getNotificationPreferences(actor),
});

export const PUT = defineRoute({
  permission: "authenticated",
  body: notificationPreferencesSchema,
  handler: ({ actor, body }) => setNotificationPreferences(actor, body.muted),
});
