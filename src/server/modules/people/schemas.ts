import { z } from "zod";

export const peopleQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(100).optional(),
  orgUnitId: z.uuid().optional(),
  status: z.enum(["invited", "active", "inactive"]).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

export const personParamsSchema = z.strictObject({ id: z.uuid() });

/**
 * Edição do próprio perfil. Objeto ESTRITO: qualquer campo fora desta lista
 * (role, tenantId, email, status…) é rejeitado com 400 — o colaborador não
 * consegue alterar papel, empresa ou dados controlados pelo RH.
 */
export const profileUpdateSchema = z
  .strictObject({
    preferredName: z.string().trim().min(1).max(80).nullable().optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[+()\d\s-]{8,20}$/, "Telefone em formato inválido")
      .nullable()
      .optional(),
    headline: z.string().trim().max(160).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo.");
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
