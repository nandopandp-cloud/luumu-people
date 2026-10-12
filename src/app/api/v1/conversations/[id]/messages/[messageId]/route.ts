import { defineRoute } from "@/server/http/route";
import { deleteMessage, editMessage } from "@/server/modules/friends/conversations";
import { editMessageSchema, messageParamsSchema } from "@/server/modules/friends/schemas";

/** Corrige o texto de uma mensagem própria (fica marcada como editada). */
export const PATCH = defineRoute({
  permission: "authenticated",
  params: messageParamsSchema,
  body: editMessageSchema,
  handler: ({ actor, params, body }) => editMessage(actor, params.id, params.messageId, body.body),
});

/** Apaga uma mensagem própria (texto e anexo descartados). */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: messageParamsSchema,
  handler: ({ actor, params }) => deleteMessage(actor, params.id, params.messageId),
});
