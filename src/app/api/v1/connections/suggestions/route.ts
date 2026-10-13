import { defineRoute } from "@/server/http/route";
import { listSuggestions } from "@/server/modules/friends/connections";
import { listLimitSchema } from "@/server/modules/friends/schemas";

/** Pessoas que você talvez conheça (sem vínculo ainda, por afinidade). */
export const GET = defineRoute({
  permission: "authenticated",
  query: listLimitSchema,
  handler: async ({ actor, query }) => ({ items: await listSuggestions(actor, query.limit) }),
});
