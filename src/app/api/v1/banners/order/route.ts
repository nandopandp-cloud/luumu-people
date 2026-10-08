import { defineRoute } from "@/server/http/route";
import { bannerOrderSchema } from "@/server/modules/banners/schemas";
import { reorderBanners } from "@/server/modules/banners/service";

/** Reordena o carrossel da home: `{ ids }` na nova ordem. */
export const PUT = defineRoute({
  permission: "comms.announcement.publish",
  body: bannerOrderSchema,
  handler: ({ actor, body, meta }) => reorderBanners(actor, body.ids, meta),
});
