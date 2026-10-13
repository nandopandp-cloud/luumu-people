import { defineRoute } from "@/server/http/route";
import { requestMany } from "@/server/modules/friends/connections";
import { requestManySchema } from "@/server/modules/friends/schemas";

/** Convidar colegas: pede amizade a várias pessoas de uma vez (até 30). */
export const POST = defineRoute({
  permission: "authenticated",
  body: requestManySchema,
  handler: ({ actor, body }) => requestMany(actor, body.userIds),
});
