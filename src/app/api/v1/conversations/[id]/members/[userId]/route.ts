import { defineRoute } from "@/server/http/route";
import { removeMember } from "@/server/modules/friends/conversations";
import { memberParamsSchema } from "@/server/modules/friends/schemas";

/** Remove alguém do grupo (administração) ou sai dele (a própria pessoa). */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: memberParamsSchema,
  handler: ({ actor, params }) => removeMember(actor, params.id, params.userId),
});
