import { defineRoute } from "@/server/http/route";
import { reorderQuickLinks } from "@/server/modules/communication/quick-links";
import { orderSchema } from "@/server/modules/communication/schemas";

export const PUT = defineRoute({
  permission: "comms.quicklink.manage",
  body: orderSchema,
  handler: ({ actor, body, meta }) => reorderQuickLinks(actor, body.ids, meta),
});
