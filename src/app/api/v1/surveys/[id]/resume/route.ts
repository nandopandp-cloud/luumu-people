import { defineRoute } from "@/server/http/route";
import { resumeInputSchema, surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { resumeSurvey } from "@/server/modules/surveys/service";

/** Retoma a pesquisa pausada (opcionalmente com novo prazo). */
export const POST = defineRoute({
  permission: "survey.launch",
  params: surveyParamsSchema,
  body: resumeInputSchema,
  handler: ({ actor, params, body, meta }) => resumeSurvey(actor, params.id, body.closesAt, meta),
});
