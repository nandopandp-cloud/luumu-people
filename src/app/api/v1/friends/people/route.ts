import { defineRoute } from "@/server/http/route";
import { peopleQuerySchema } from "@/server/modules/friends/schemas";
import { listColleagues } from "@/server/modules/friends/service";

/** Colegas ativos da empresa para encontrar e adicionar amigos (só o cartão profissional público). */
export const GET = defineRoute({
  permission: "authenticated",
  query: peopleQuerySchema,
  handler: ({ actor, query }) => listColleagues(actor, query),
});
