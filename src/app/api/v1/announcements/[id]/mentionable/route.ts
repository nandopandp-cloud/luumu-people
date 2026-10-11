import { defineRoute } from "@/server/http/route";
import { listMentionable } from "@/server/modules/announcements/engagement";
import { announcementParamsSchema, mentionableQuerySchema } from "@/server/modules/announcements/schemas";

/** Sugestões de menção: só quem vê o comunicado, e só nome e foto. */
export const GET = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  query: mentionableQuerySchema,
  handler: async ({ actor, params, query }) => ({ items: await listMentionable(actor, params.id, query.q) }),
});
