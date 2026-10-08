import { defineRoute } from "@/server/http/route";
import { bannerInputSchema } from "@/server/modules/banners/schemas";
import { createBanner, listManagedBanners } from "@/server/modules/banners/service";

export const GET = defineRoute({
  permission: "comms.announcement.publish",
  handler: async ({ actor }) => ({ items: await listManagedBanners(actor) }),
});

export const POST = defineRoute({
  permission: "comms.announcement.publish",
  body: bannerInputSchema,
  handler: ({ actor, body, meta }) => createBanner(actor, body, meta),
});
