import { defineRoute } from "@/server/http/route";
import { likeAnnouncement, unlikeAnnouncement } from "@/server/modules/announcements/engagement";
import { announcementParamsSchema } from "@/server/modules/announcements/schemas";

/** Curtir/descurtir em nome próprio (qualquer pessoa que veja o comunicado). */
export const POST = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  handler: ({ actor, params }) => likeAnnouncement(actor, params.id),
});

export const DELETE = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  handler: ({ actor, params }) => unlikeAnnouncement(actor, params.id),
});
