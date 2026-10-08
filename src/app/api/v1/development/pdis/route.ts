import { defineRoute } from "@/server/http/route";
import { pdiInputSchema } from "@/server/modules/development/schemas";
import { createPdi } from "@/server/modules/development/service";

/** Cria um PDI (próprio, ou de alguém no escopo de development.pdi.manage). */
export const POST = defineRoute({
  permission: "authenticated",
  body: pdiInputSchema,
  async handler({ actor, body, meta }) {
    return Response.json(await createPdi(actor, body, meta), { status: 201 });
  },
});
