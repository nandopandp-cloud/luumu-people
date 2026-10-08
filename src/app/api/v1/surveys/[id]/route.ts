import { defineRoute } from "@/server/http/route";
import { surveyInputSchema, surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { deleteSurvey, getManagedSurvey, updateSurvey } from "@/server/modules/surveys/service";

export const GET = defineRoute({
  permission: "management.access",
  params: surveyParamsSchema,
  handler: ({ actor, params }) => getManagedSurvey(actor, params.id),
});

/** Somente rascunhos: depois do lançamento perguntas, k e dimensões congelam. */
export const PUT = defineRoute({
  permission: "survey.design",
  params: surveyParamsSchema,
  body: surveyInputSchema,
  handler: ({ actor, params, body, meta }) => updateSurvey(actor, params.id, body, meta),
});

export const DELETE = defineRoute({
  permission: "survey.design",
  params: surveyParamsSchema,
  handler: ({ actor, params, meta }) => deleteSurvey(actor, params.id, meta),
});
