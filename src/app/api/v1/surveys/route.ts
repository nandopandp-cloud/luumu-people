import { defineRoute } from "@/server/http/route";
import { surveyInputSchema } from "@/server/modules/surveys/schemas";
import { createSurvey, listManagedSurveys } from "@/server/modules/surveys/service";

export const GET = defineRoute({
  permission: "management.access",
  handler: async ({ actor }) => ({ items: await listManagedSurveys(actor) }),
});

export const POST = defineRoute({
  permission: "survey.design",
  body: surveyInputSchema,
  handler: ({ actor, body, meta }) => createSurvey(actor, body, meta),
});
