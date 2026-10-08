import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { profileUpdateSchema } from "@/server/modules/people/schemas";
import { getMyProfile, updateMyProfile } from "@/server/modules/people/service";

export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => getMyProfile(actor),
});

export const PATCH = defineRoute({
  permission: "authenticated",
  body: profileUpdateSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  async handler({ actor, body, meta }) {
    await updateMyProfile(actor, body, meta);
    return getMyProfile(actor);
  },
});
