import { defineRoute } from "@/server/http/route";
import { listFriends } from "@/server/modules/friends/service";

/** Amigos da própria pessoa (cartão de colega, sentimento do dia e presença). */
export const GET = defineRoute({
  permission: "authenticated",
  handler: async ({ actor }) => ({ items: await listFriends(actor) }),
});
