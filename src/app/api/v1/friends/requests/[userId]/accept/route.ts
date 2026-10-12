import { defineRoute } from "@/server/http/route";
import { userParamsSchema } from "@/server/modules/friends/schemas";
import { acceptFriendship } from "@/server/modules/friends/service";

/** Aceita o pedido de amizade recebido. */
export const POST = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => acceptFriendship(actor, params.userId),
});
