import { defineRoute } from "@/server/http/route";
import { announcementInputSchema, announcementParamsSchema } from "@/server/modules/announcements/schemas";
import { deleteAnnouncement, getManagedAnnouncement, updateAnnouncement } from "@/server/modules/announcements/service";

export const GET = defineRoute({
  permission: "comms.announcement.create",
  params: announcementParamsSchema,
  handler: ({ actor, params }) => getManagedAnnouncement(actor, params.id),
});

export const PUT = defineRoute({
  permission: "comms.announcement.create",
  params: announcementParamsSchema,
  body: announcementInputSchema,
  handler: ({ actor, params, body, meta }) => updateAnnouncement(actor, params.id, body, meta),
});

/** Somente rascunhos. */
export const DELETE = defineRoute({
  permission: "comms.announcement.create",
  params: announcementParamsSchema,
  handler: ({ actor, params, meta }) => deleteAnnouncement(actor, params.id, meta),
});
