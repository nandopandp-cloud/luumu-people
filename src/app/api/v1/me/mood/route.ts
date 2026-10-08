import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { moodInputSchema } from "@/server/modules/wellbeing/schemas";
import { getTodayMood, setTodayMood } from "@/server/modules/wellbeing/service";

/** Check-in de humor do próprio colaborador (somente o titular lê e grava). */
export const GET = defineRoute({
  permission: "authenticated",
  handler: async ({ actor }) => ({ mood: await getTodayMood(actor) }),
});

export const PUT = defineRoute({
  permission: "authenticated",
  body: moodInputSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: async ({ actor, body }) => ({ mood: await setTodayMood(actor, body) }),
});
