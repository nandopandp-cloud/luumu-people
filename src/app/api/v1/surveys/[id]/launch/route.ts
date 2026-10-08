import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { launchInputSchema, surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { launchSurvey } from "@/server/modules/surveys/service";

export const POST = defineRoute({
  permission: "survey.launch",
  params: surveyParamsSchema,
  body: launchInputSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, body, meta }) => launchSurvey(actor, params.id, body.closesAt, meta),
});
