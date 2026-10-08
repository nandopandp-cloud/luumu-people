import { defineRoute } from "@/server/http/route";
import { listOrgUnits } from "@/server/modules/organization/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => listOrgUnits(actor),
});
