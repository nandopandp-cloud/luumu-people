import { defineRoute } from "@/server/http/route";
import { announcementInputSchema } from "@/server/modules/announcements/schemas";
import { createAnnouncement } from "@/server/modules/announcements/service";

export const POST = defineRoute({
  permission: "comms.announcement.create",
  body: announcementInputSchema,
  handler: ({ actor, body, meta }) => createAnnouncement(actor, body, meta),
});
