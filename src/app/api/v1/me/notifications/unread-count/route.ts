import { defineRoute } from "@/server/http/route";
import { countUnread } from "@/server/modules/notifications/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: async ({ actor }) => ({ unread: await countUnread(actor) }),
});
