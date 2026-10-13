import { defineRoute } from "@/server/http/route";
import { discoverPeople } from "@/server/modules/friends/connections";
import { discoverQuerySchema } from "@/server/modules/friends/schemas";

/** Descobrir pessoas: busca por nome, cargo, área ou interesse; filtros de time, departamento, interesses e conexões. */
export const GET = defineRoute({
  permission: "authenticated",
  query: discoverQuerySchema,
  handler: ({ actor, query }) => discoverPeople(actor, { q: query.q, filter: query.filtro, area: query.area, location: query.local, interest: query.interesse, limit: query.limit }),
});
