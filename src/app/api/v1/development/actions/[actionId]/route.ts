import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { actionUpdateSchema } from "@/server/modules/development/schemas";
import { updateAction } from "@/server/modules/development/service";

/** Atualiza uma ação do PDI (status, evidência, prazo…). */
export const PATCH = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ actionId: z.uuid() }),
  body: actionUpdateSchema,
  handler: ({ actor, params, body, meta }) => updateAction(actor, params.actionId, body, meta),
});
