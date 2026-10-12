import { defineRoute } from "@/server/http/route";
import { dismissTodayMoodPrompt } from "@/server/modules/wellbeing/service";

/** Fechou o modal do sentimento sem responder: não reabre sozinho hoje. */
export const POST = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => dismissTodayMoodPrompt(actor),
});
