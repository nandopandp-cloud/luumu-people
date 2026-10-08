import { defineRoute } from "@/server/http/route";
import { personParamsSchema } from "@/server/modules/people/schemas";
import { getPerson } from "@/server/modules/people/service";

export const GET = defineRoute({
  permission: "people.directory.read",
  params: personParamsSchema,
  handler: ({ actor, params }) => getPerson(actor, params.id),
});
