import { z } from "zod";
import { SCOPES } from "@/server/authz/permissions";

export const roleGrantSchema = z
  .strictObject({
    roleId: z.uuid(),
    scopeType: z.enum(SCOPES),
    scopeOrgUnitId: z.uuid().nullable().optional(),
  })
  .refine((v) => (v.scopeType === "ORG_UNIT_TREE") === Boolean(v.scopeOrgUnitId), {
    message: "Informe a área apenas para o escopo ORG_UNIT_TREE.",
    path: ["scopeOrgUnitId"],
  });
export type RoleGrantInput = z.infer<typeof roleGrantSchema>;

export const roleAssignmentParamsSchema = z.strictObject({ id: z.uuid(), assignmentId: z.uuid() });
