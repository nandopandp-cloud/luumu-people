import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { answersInputSchema, surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { submitSurveyResponse } from "@/server/modules/surveys/service";

/**
 * Envio de resposta ANÔNIMA. `anonymous`: sem log de payload, caminho ou
 * usuário, e rate limit só em memória. Nada é auditado (docs/anonymous-surveys.md).
 */
export const POST = defineRoute({
  permission: "authenticated",
  anonymous: true,
  params: surveyParamsSchema,
  body: answersInputSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, body }) => submitSurveyResponse(actor, params.id, body.answers),
});
