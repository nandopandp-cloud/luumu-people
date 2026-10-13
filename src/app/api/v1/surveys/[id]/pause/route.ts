import { defineRoute } from "@/server/http/route";
import { surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { pauseSurvey } from "@/server/modules/surveys/service";

/** Pausa a pesquisa: ninguém responde até retomar. */
export const POST = defineRoute({
  permission: "survey.launch",
  params: surveyParamsSchema,
  handler: ({ actor, params, meta }) => pauseSurvey(actor, params.id, meta),
});
