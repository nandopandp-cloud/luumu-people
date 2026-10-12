import { defineRoute } from "@/server/http/route";
import { deleteMessage } from "@/server/modules/friends/conversations";
import { messageParamsSchema } from "@/server/modules/friends/schemas";

/** Apaga uma mensagem própria (texto e anexo descartados). */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: messageParamsSchema,
  handler: ({ actor, params }) => deleteMessage(actor, params.id, params.messageId),
});
