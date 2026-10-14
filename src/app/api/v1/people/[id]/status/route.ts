import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { setPersonStatus } from "@/server/modules/people/admin";
import { personParamsSchema, personStatusSchema } from "@/server/modules/people/schemas";

/** Desativa ou reativa o acesso de uma pessoa (nunca o próprio). */
export const POST = defineRoute({
  permission: "people.manage",
  params: personParamsSchema,
  body: personStatusSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, body, meta }) => setPersonStatus(actor, params.id, body.status, meta),
});
