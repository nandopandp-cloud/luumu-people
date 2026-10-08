import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { roleAssignmentParamsSchema } from "@/server/modules/access/schemas";
import { revokeRole } from "@/server/modules/access/service";

export const DELETE = defineRoute({
  permission: "access.roles.assign",
  params: roleAssignmentParamsSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, meta }) => revokeRole(actor, params.id, params.assignmentId, meta),
});
