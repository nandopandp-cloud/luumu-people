import { defineRoute } from "@/server/http/route";
import { assessmentInputSchema } from "@/server/modules/development/schemas";
import { assessCompetency } from "@/server/modules/development/service";

/** Autoavaliação ou avaliação (gestor/G&G) de uma competência — histórico append-only. */
export const POST = defineRoute({
  permission: "authenticated",
  body: assessmentInputSchema,
  async handler({ actor, body, meta }) {
    return Response.json(await assessCompetency(actor, body, meta), { status: 201 });
  },
});
