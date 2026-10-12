import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { defineRoute } from "@/server/http/route";
import { listMessages, sendMessage } from "@/server/modules/friends/conversations";
import { conversationParamsSchema, messagesQuerySchema, sendMessageSchema } from "@/server/modules/friends/schemas";

/** Mensagens da conversa (página mais recente, anteriores ou novidades) + leitura, digitação e presença. */
export const GET = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  params: conversationParamsSchema,
  query: messagesQuerySchema,
  handler: ({ actor, params, query }) => listMessages(actor, params.id, query),
});

/** Envia uma mensagem em nome próprio (texto e/ou anexo). */
export const POST = defineRoute({
  permission: "authenticated",
  params: conversationParamsSchema,
  body: sendMessageSchema,
  handler: async ({ actor, params, body }) => Response.json(await sendMessage(actor, params.id, body), { status: 201 }),
});
