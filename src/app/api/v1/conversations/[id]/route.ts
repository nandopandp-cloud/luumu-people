import { defineRoute } from "@/server/http/route";
import { getConversation, renameGroup } from "@/server/modules/friends/conversations";
import { conversationParamsSchema, renameGroupSchema } from "@/server/modules/friends/schemas";

/** Detalhes da conversa (só para quem participa). */
export const GET = defineRoute({
  permission: "authenticated",
  params: conversationParamsSchema,
  handler: ({ actor, params }) => getConversation(actor, params.id),
});

/** Renomeia o grupo (administração do grupo). */
export const PATCH = defineRoute({
  permission: "authenticated",
  params: conversationParamsSchema,
  body: renameGroupSchema,
  handler: ({ actor, params, body }) => renameGroup(actor, params.id, body.title),
});
