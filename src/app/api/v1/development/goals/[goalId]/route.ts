import { z } from "zod";
import { defineRoute } from "@/server/http/route";
import { goalUpdateSchema } from "@/server/modules/development/schemas";
import { updateGoal } from "@/server/modules/development/service";

/** Edita um objetivo do PDI (título, descrição, competência, prazo e etiquetas) — só a liderança. */
export const PATCH = defineRoute({
  permission: "authenticated",
  params: z.strictObject({ goalId: z.uuid() }),
  body: goalUpdateSchema,
  handler: ({ actor, params, body, meta }) => updateGoal(actor, params.goalId, body, meta),
});
