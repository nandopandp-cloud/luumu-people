import { defineRoute } from "@/server/http/route";
import { dismissSuggestion } from "@/server/modules/friends/connections";
import { userParamsSchema } from "@/server/modules/friends/schemas";

/** Dispensa a sugestão (o "x" do cartão). */
export const POST = defineRoute({
  permission: "authenticated",
  params: userParamsSchema,
  handler: ({ actor, params }) => dismissSuggestion(actor, params.userId),
});
