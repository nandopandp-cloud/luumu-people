import { defineRoute } from "@/server/http/route";
import { surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { closeSurvey } from "@/server/modules/surveys/service";

export const POST = defineRoute({
  permission: "survey.launch",
  params: surveyParamsSchema,
  handler: ({ actor, params, meta }) => closeSurvey(actor, params.id, meta),
});
