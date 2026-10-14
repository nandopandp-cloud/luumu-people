import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { resendInvite } from "@/server/modules/people/admin";
import { personParamsSchema } from "@/server/modules/people/schemas";

/** Reenvia o convite de acesso (só para quem ainda está "convidado"). */
export const POST = defineRoute({
  permission: "people.manage",
  params: personParamsSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, meta }) => resendInvite(actor, params.id, meta),
});
