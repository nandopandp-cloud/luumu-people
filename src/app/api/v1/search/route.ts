import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { quickLinks, search } from "@/server/modules/search/service";

/** Busca da paleta (⌘K). Sem termo: atalhos de navegação. */
export const GET = defineRoute({
  permission: "authenticated",
  query: z.strictObject({ q: z.string().max(80).default(""), context: z.enum(["employee", "management"]).default("employee") }),
  handler: async ({ actor, query }) =>
    query.q.trim().length >= 2 ? { groups: await search(actor, query.q, query.context) } : { groups: [], quick: await quickLinks(actor, query.context) },
});
