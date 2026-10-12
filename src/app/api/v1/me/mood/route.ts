import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { moodInputSchema } from "@/server/modules/wellbeing/schemas";
import { getTodayMood, setTodayMood } from "@/server/modules/wellbeing/service";

/** Sentimento do dia da própria pessoa (ler, registrar ou mudar ao longo do dia). */
export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => getTodayMood(actor),
});

export const PUT = defineRoute({
  permission: "authenticated",
  body: moodInputSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, body }) => setTodayMood(actor, body),
});
