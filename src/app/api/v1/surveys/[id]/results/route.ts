import { defineRoute } from "@/server/http/route";
import { resultsQuerySchema, surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { getSurveyResults } from "@/server/modules/surveys/service";

/** Somente agregados com supressão por k. Não existe leitura individual. */
export const GET = defineRoute({
  permission: "survey.results.read_aggregate",
  params: surveyParamsSchema,
  query: resultsQuerySchema,
  handler: ({ actor, params, query }) => getSurveyResults(actor, params.id, query),
});
