import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { defineRoute } from "@/server/http/route";
import { recordActivity } from "@/server/modules/usage/service";

/** Sinal de atividade: "online agora" para amigos e o uso da plataforma (só agregado no dashboard). */
export const POST = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  async handler({ actor }) {
    await recordActivity(actor);
  },
});
