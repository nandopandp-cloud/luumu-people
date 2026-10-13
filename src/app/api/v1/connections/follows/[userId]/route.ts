import { defineRoute } from "@/server/http/route";
import { setFollowing } from "@/server/modules/friends/connections";
import { userParamsSchema } from "@/server/modules/friends/schemas";

/** Seguir (sem aprovação). */
export const PUT = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => setFollowing(actor, params.userId, true),
});

/** Deixar de seguir. */
export const DELETE = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => setFollowing(actor, params.userId, false),
});
