import { defineRoute } from "@/server/http/route";
import { addMembers } from "@/server/modules/friends/conversations";
import { addMembersSchema, conversationParamsSchema } from "@/server/modules/friends/schemas";

/** Adiciona amigos ao grupo (administração do grupo). */
export const POST = defineRoute({
  permission: "authenticated",
  params: conversationParamsSchema,
  body: addMembersSchema,
  handler: ({ actor, params, body }) => addMembers(actor, params.id, body.userIds),
});
