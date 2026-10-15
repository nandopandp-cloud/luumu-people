import { defineRoute } from "@/server/http/route";
import { audienceQuerySchema } from "@/server/modules/surveys/schemas";
import { getAudienceSize } from "@/server/modules/surveys/service";

/** Quantas pessoas ativas o público teria (empresa toda ou uma área com subáreas) e o k exigido. */
export const GET = defineRoute({
  permission: "survey.launch",
  query: audienceQuerySchema,
  handler: ({ actor, query }) => getAudienceSize(actor, query.orgUnitId),
});
