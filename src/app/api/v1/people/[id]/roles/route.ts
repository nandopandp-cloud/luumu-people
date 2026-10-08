import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { roleGrantSchema } from "@/server/modules/access/schemas";
import { grantRole, listUserRoles } from "@/server/modules/access/service";
import { personParamsSchema } from "@/server/modules/people/schemas";

export const GET = defineRoute({
  permission: "access.roles.assign",
  params: personParamsSchema,
  handler: ({ actor, params }) => listUserRoles(actor, params.id),
});

export const POST = defineRoute({
  permission: "access.roles.assign",
  params: personParamsSchema,
  body: roleGrantSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, params, body, meta }) {
    const created = await grantRole(actor, params.id, body, meta);
    return Response.json(created, { status: 201 });
  },
});
