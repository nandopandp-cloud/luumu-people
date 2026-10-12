import { defineRoute } from "@/server/http/route";
import { friendRequestSchema } from "@/server/modules/friends/schemas";
import { listRequests, requestFriendship } from "@/server/modules/friends/service";

/** Pedidos de amizade recebidos e enviados. */
export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => listRequests(actor),
});

/** Pede amizade (se a outra pessoa já tinha pedido, vira amizade). */
export const POST = defineRoute({
  permission: "authenticated",
  body: friendRequestSchema,
  handler: ({ actor, body }) => requestFriendship(actor, body.userId),
});
