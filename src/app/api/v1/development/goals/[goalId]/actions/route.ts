import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { actionInputSchema } from "@/server/modules/development/schemas";
import { addAction } from "@/server/modules/development/service";

export const POST = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ goalId: z.uuid() }),
  body: actionInputSchema,
  async handler({ actor, params, body, meta }) {
    return Response.json(await addAction(actor, params.goalId, body, meta), { status: 201 });
  },
});
