import { defineRoute } from "@/server/http/route";
import { reactToAnnouncement, removeReaction } from "@/server/modules/announcements/engagement";
import { announcementParamsSchema, reactionInputSchema } from "@/server/modules/announcements/schemas";

/** Reagir (ou trocar de reação) e remover a reação, em nome próprio, em comunicado que a pessoa vê. */
export const PUT = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  body: reactionInputSchema,
  handler: ({ actor, params, body }) => reactToAnnouncement(actor, params.id, body.kind),
});

export const DELETE = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  handler: ({ actor, params }) => removeReaction(actor, params.id),
});
