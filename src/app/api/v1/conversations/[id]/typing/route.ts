import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { defineRoute } from "@/server/http/route";
import { signalTyping } from "@/server/modules/friends/conversations";
import { conversationParamsSchema } from "@/server/modules/friends/schemas";

/** Sinal de "digitando…" (expira em alguns segundos). */
export const POST = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  params: conversationParamsSchema,
  handler: ({ actor, params }) => signalTyping(actor, params.id),
});
