import { defineRoute } from "@/server/http/route";
import { listSharedMedia } from "@/server/modules/friends/conversations";
import { conversationParamsSchema } from "@/server/modules/friends/schemas";

/** Fotos, arquivos e links compartilhados na conversa. */
export const GET = defineRoute({
  permission: "authenticated",
  params: conversationParamsSchema,
  handler: ({ actor, params }) => listSharedMedia(actor, params.id),
});
