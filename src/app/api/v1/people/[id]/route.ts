import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { updatePerson } from "@/server/modules/people/admin";
import { personParamsSchema, personUpdateSchema } from "@/server/modules/people/schemas";
import { getPerson } from "@/server/modules/people/service";

export const GET = defineRoute({
  permission: "people.directory.read",
  params: personParamsSchema,
  handler: ({ actor, params }) => getPerson(actor, params.id),
});

/** Edita os dados profissionais e de RH (people.manage, empresa toda). Mudanças de lotação e gestor(a) geram histórico. */
export const PATCH = defineRoute({
  permission: "people.manage",
  params: personParamsSchema,
  body: personUpdateSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, body, meta }) => updatePerson(actor, params.id, body, meta),
});
