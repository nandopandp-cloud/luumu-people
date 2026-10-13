import { defineRoute } from "@/server/http/route";
import { listFeatured } from "@/server/modules/friends/connections";
import { listLimitSchema } from "@/server/modules/friends/schemas";

/** Pessoas em destaque: mais atividade pública recente nos comunicados. */
export const GET = defineRoute({
  permission: "authenticated",
  query: listLimitSchema,
  handler: async ({ actor, query }) => ({ items: await listFeatured(actor, query.limit) }),
});
