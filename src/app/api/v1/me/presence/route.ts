import { defineRoute } from "@/server/http/route";
import { touchPresence } from "@/server/modules/friends/conversations";

/** Sinal de atividade ("online agora" para amigos e quem conversa com a pessoa). */
export const POST = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => touchPresence(actor),
});
