import { defineRoute } from "@/server/http/route";
import { listConversations, openConversation } from "@/server/modules/friends/conversations";
import { newConversationSchema } from "@/server/modules/friends/schemas";

/** Conversas da própria pessoa (privadas e grupos). */
export const GET = defineRoute({
  permission: "authenticated",
  handler: async ({ actor }) => ({ items: await listConversations(actor) }),
});

/** Abre a conversa privada com um amigo ou cria um grupo com amigos. */
export const POST = defineRoute({
  permission: "authenticated",
  body: newConversationSchema,
  handler: async ({ actor, body }) => Response.json(await openConversation(actor, body), { status: 201 }),
});
