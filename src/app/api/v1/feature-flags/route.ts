import { defineRoute } from "@/server/http/route";
import { effectiveFlags } from "@/server/modules/flags/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => effectiveFlags(actor),
});
