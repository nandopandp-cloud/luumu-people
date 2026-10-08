import { defineRoute } from "@/server/http/route";
import { announcementParamsSchema, publishInputSchema } from "@/server/modules/announcements/schemas";
import { publishAnnouncement } from "@/server/modules/announcements/service";

/** Publica agora ou agenda (`publishAt` futuro). */
export const POST = defineRoute({
  permission: "comms.announcement.publish",
  params: announcementParamsSchema,
  body: publishInputSchema,
  handler: ({ actor, params, body, meta }) => publishAnnouncement(actor, params.id, body.publishAt, meta),
});
