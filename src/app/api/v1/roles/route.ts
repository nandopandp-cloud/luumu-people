import { defineRoute } from "@/server/http/route";
import { listRoles } from "@/server/modules/access/service";

export const GET = defineRoute({
  permission: "access.roles.assign",
  handler: ({ actor }) => listRoles(actor),
});
