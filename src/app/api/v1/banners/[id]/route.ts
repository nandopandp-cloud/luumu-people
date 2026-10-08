import { defineRoute } from "@/server/http/route";
import { bannerInputSchema, bannerParamsSchema } from "@/server/modules/banners/schemas";
import { deleteBanner, getManagedBanner, updateBanner } from "@/server/modules/banners/service";

export const GET = defineRoute({
  permission: "comms.announcement.publish",
  params: bannerParamsSchema,
  handler: ({ actor, params }) => getManagedBanner(actor, params.id),
});

export const PUT = defineRoute({
  permission: "comms.announcement.publish",
  params: bannerParamsSchema,
  body: bannerInputSchema,
  handler: ({ actor, params, body, meta }) => updateBanner(actor, params.id, body, meta),
});

export const DELETE = defineRoute({
  permission: "comms.announcement.publish",
  params: bannerParamsSchema,
  handler: ({ actor, params, meta }) => deleteBanner(actor, params.id, meta),
});
