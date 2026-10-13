import { defineRoute } from "@/server/http/route";
import { surveyParamsSchema } from "@/server/modules/surveys/schemas";
import { duplicateSurvey } from "@/server/modules/surveys/service";

/** Duplica a pesquisa como um novo rascunho (perguntas, tipo e k). */
export const POST = defineRoute({
  permission: "survey.design",
  params: surveyParamsSchema,
  async handler({ actor, params, meta }) {
    return Response.json(await duplicateSurvey(actor, params.id, meta), { status: 201 });
  },
});
