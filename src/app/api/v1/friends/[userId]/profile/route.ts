import { defineRoute } from "@/server/http/route";
import { userParamsSchema } from "@/server/modules/friends/schemas";
import { getColleagueProfile } from "@/server/modules/friends/service";

/** Perfil do colega: cartão, frase, capa, amigos e grupos em comum. */
export const GET = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => getColleagueProfile(actor, params.userId),
});
