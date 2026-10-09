import { defineRoute } from "@/server/http/route";
import { createQuickLink, listManagedQuickLinks } from "@/server/modules/communication/quick-links";
import { quickLinkInputSchema } from "@/server/modules/communication/schemas";

export const GET = defineRoute({
  permission: "comms.quicklink.manage",
  handler: async ({ actor }) => ({ items: await listManagedQuickLinks(actor) }),
});

export const POST = defineRoute({
  permission: "comms.quicklink.manage",
  body: quickLinkInputSchema,
  handler: ({ actor, body, meta }) => createQuickLink(actor, body, meta),
});
