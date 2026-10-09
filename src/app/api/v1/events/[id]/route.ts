import { defineRoute } from "@/server/http/route";
import { deleteEvent, getManagedEvent, updateEvent } from "@/server/modules/communication/events";
import { eventInputSchema, idParamsSchema } from "@/server/modules/communication/schemas";

export const GET = defineRoute({
  permission: "comms.event.manage",
  params: idParamsSchema,
  handler: ({ actor, params }) => getManagedEvent(actor, params.id),
});

export const PUT = defineRoute({
  permission: "comms.event.manage",
  params: idParamsSchema,
  body: eventInputSchema,
  handler: ({ actor, params, body, meta }) => updateEvent(actor, params.id, body, meta),
});

export const DELETE = defineRoute({
  permission: "comms.event.manage",
  params: idParamsSchema,
  handler: ({ actor, params, meta }) => deleteEvent(actor, params.id, meta),
});
