import { defineRoute } from "@/server/http/route";
import { SENSITIVE_RATE_LIMIT } from "@/server/http/rate-limit";
import { addComment, listComments } from "@/server/modules/announcements/engagement";
import { announcementParamsSchema, commentInputSchema } from "@/server/modules/announcements/schemas";

export const GET = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  handler: async ({ actor, params }) => ({ items: await listComments(actor, params.id) }),
});

export const POST = defineRoute({
  permission: "authenticated",
  params: announcementParamsSchema,
  body: commentInputSchema,
  rateLimit: SENSITIVE_RATE_LIMIT,
  handler: ({ actor, params, body }) => addComment(actor, params.id, body.body),
});
