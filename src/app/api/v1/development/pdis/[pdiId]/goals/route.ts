import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { goalInputSchema } from "@/server/modules/development/schemas";
import { addGoal } from "@/server/modules/development/service";

export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ pdiId: z.uuid() }),
  body: goalInputSchema,
  async handler({ actor, params, body, meta }) {
    return Response.json(await addGoal(actor, params.pdiId, body, meta), { status: 201 });
  },
});
