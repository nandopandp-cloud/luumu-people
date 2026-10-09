import { defineRoute } from "@/server/http/route";
import { createEvent, listManagedEvents } from "@/server/modules/communication/events";
import { eventInputSchema } from "@/server/modules/communication/schemas";

export const GET = defineRoute({
  permission: "comms.event.manage",
  handler: async ({ actor }) => ({ items: await listManagedEvents(actor) }),
});

export const POST = defineRoute({
  permission: "comms.event.manage",
  body: eventInputSchema,
  handler: ({ actor, body, meta }) => createEvent(actor, body, meta),
});
