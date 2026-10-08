import { defineRoute } from "@/server/http/route";
import { announcementParamsSchema } from "@/server/modules/announcements/schemas";
import { archiveAnnouncement } from "@/server/modules/announcements/service";

export const POST = defineRoute({
  permission: "comms.announcement.publish",
  params: announcementParamsSchema,
  handler: ({ actor, params, meta }) => archiveAnnouncement(actor, params.id, meta),
});
