import { defineRoute } from "@/server/http/route";
import { competencyInputSchema } from "@/server/modules/development/schemas";
import { createCompetency, listCompetencyCatalog } from "@/server/modules/development/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => listCompetencyCatalog(actor),
});

/** Catálogo de competências da empresa (G&G/Admin). */
export const POST = defineRoute({
  permission: "development.pdi.manage",
  body: competencyInputSchema,
  async handler({ actor, body, meta }) {
    return Response.json(await createCompetency(actor, body, meta), { status: 201 });
  },
});
