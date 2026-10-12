import { defineRoute } from "@/server/http/route";
import { userParamsSchema } from "@/server/modules/friends/schemas";
import { removeFriend } from "@/server/modules/friends/service";

/** Desfaz a amizade (a conversa privada fica no histórico, sem novas mensagens). */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => removeFriend(actor, params.userId),
});
