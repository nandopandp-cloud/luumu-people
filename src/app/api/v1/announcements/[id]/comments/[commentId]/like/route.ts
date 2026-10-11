import { defineRoute } from "@/server/http/route";
import { likeComment, unlikeComment } from "@/server/modules/announcements/engagement";
import { commentParamsSchema } from "@/server/modules/announcements/schemas";

/** Curtir/descurtir um comentário em nome próprio (quem vê o comunicado). */
export const POST = defineRoute({
  permission: "authenticated",
  params: commentParamsSchema,
  handler: ({ actor, params }) => likeComment(actor, params.id, params.commentId),
});

export const DELETE = defineRoute({
  permission: "authenticated",
  params: commentParamsSchema,
  handler: ({ actor, params }) => unlikeComment(actor, params.id, params.commentId),
});
