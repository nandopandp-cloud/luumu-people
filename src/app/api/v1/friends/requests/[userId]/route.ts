import { defineRoute } from "@/server/http/route";
import { userParamsSchema } from "@/server/modules/friends/schemas";
import { dismissFriendRequest } from "@/server/modules/friends/service";

/** Recusa (recebido) ou cancela (enviado) um pedido pendente. */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => dismissFriendRequest(actor, params.userId),
});
