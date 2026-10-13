import { defineRoute } from "@/server/http/route";
import { getMyInterests, setMyInterests } from "@/server/modules/friends/connections";
import { interestsSchema } from "@/server/modules/friends/schemas";

/** Interesses do próprio perfil. */
export const GET = defineRoute({
  permission: "authenticated",
  handler: async ({ actor }) => ({ keys: await getMyInterests(actor) }),
});

/** Troca os interesses do próprio perfil (catálogo em src/lib/interests.ts). */
export const PUT = defineRoute({
  permission: "authenticated",
  body: interestsSchema,
  handler: async ({ actor, body }) => ({ keys: await setMyInterests(actor, body.keys) }),
});
