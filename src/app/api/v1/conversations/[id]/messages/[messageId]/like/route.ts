import { defineRoute } from "@/server/http/route";
import { setMessageLike } from "@/server/modules/friends/conversations";
import { messageParamsSchema } from "@/server/modules/friends/schemas";

/** Curte uma mensagem da conversa, em nome próprio. */
export const PUT = defineRoute({
  permission: "authenticated",
  params: messageParamsSchema,
  handler: ({ actor, params }) => setMessageLike(actor, params.id, params.messageId, true),
});

/** Desfaz a própria curtida. */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: messageParamsSchema,
  handler: ({ actor, params }) => setMessageLike(actor, params.id, params.messageId, false),
});
