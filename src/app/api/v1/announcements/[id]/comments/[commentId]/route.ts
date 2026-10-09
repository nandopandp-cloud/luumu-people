import { defineRoute } from "@/server/http/route";
import { removeComment } from "@/server/modules/announcements/engagement";
import { commentParamsSchema } from "@/server/modules/announcements/schemas";

/** Remove: o próprio autor ou quem modera (checado no serviço). */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: commentParamsSchema,
  handler: ({ actor, params, meta }) => removeComment(actor, params.id, params.commentId, meta),
});
