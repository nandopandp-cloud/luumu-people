import { defineRoute } from "@/server/http/route";
import { auditQuerySchema, listAuditLogs } from "@/server/modules/audit/service";

export const GET = defineRoute({
  permission: "audit.read",
  query: auditQuerySchema,
  handler: ({ actor, query }) => listAuditLogs(actor, query),
});
