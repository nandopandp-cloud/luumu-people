import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { defineRoute } from "@/server/http/route";
import { markConversationRead } from "@/server/modules/friends/conversations";
import { conversationParamsSchema } from "@/server/modules/friends/schemas";

/** Marca a conversa como lida até agora. */
export const POST = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  params: conversationParamsSchema,
  handler: ({ actor, params }) => markConversationRead(actor, params.id),
});
