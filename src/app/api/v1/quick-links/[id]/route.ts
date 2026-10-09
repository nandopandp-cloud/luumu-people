import { defineRoute } from "@/server/http/route";
import { deleteQuickLink, updateQuickLink } from "@/server/modules/communication/quick-links";
import { idParamsSchema, quickLinkInputSchema } from "@/server/modules/communication/schemas";

export const PUT = defineRoute({
  permission: "comms.quicklink.manage",
  params: idParamsSchema,
  body: quickLinkInputSchema,
  handler: ({ actor, params, body, meta }) => updateQuickLink(actor, params.id, body, meta),
});

export const DELETE = defineRoute({
  permission: "comms.quicklink.manage",
  params: idParamsSchema,
  handler: ({ actor, params, meta }) => deleteQuickLink(actor, params.id, meta),
});
