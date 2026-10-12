import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { defineRoute } from "@/server/http/route";
import { touchPresence } from "@/server/modules/friends/conversations";

/** Sinal de atividade ("online agora" para amigos e quem conversa com a pessoa). */
export const POST = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  handler: ({ actor }) => touchPresence(actor),
});
