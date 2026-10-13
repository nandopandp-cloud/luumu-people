import { defineRoute } from "@/server/http/route";
import { CHAT_SYNC_RATE_LIMIT } from "@/server/http/rate-limit";
import { listOnlineFriends } from "@/server/modules/friends/connections";
import { listLimitSchema } from "@/server/modules/friends/schemas";

/** Amigos online agora. */
export const GET = defineRoute({
  permission: "authenticated",
  rateLimit: CHAT_SYNC_RATE_LIMIT,
  query: listLimitSchema,
  handler: ({ actor, query }) => listOnlineFriends(actor, query.limit),
});
