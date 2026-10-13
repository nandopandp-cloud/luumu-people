import { defineRoute } from "@/server/http/route";
import { connectionsCounts } from "@/server/modules/friends/connections";

/** Contadores: amigos, pedidos recebidos e enviados, amigos online. */
export const GET = defineRoute({
  permission: "authenticated",
  handler: ({ actor }) => connectionsCounts(actor),
});
