import { z } from "zod";

const USER_STATUS_VALUES = ["invited", "active", "inactive"] as const;

export const peopleQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(100).optional(),
  orgUnitId: z.uuid().optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

export const personParamsSchema = z.strictObject({ id: z.uuid() });

export const DIRECTORY_SORTS = ["name", "position", "orgUnit", "manager", "status", "lastAccess"] as const;
export const DIRECTORY_PAGE_SIZES = [10, 25, 50] as const;

/** Diretório da gestão (página de Colaboradores): filtros, ordenação e paginação numerada. */
export const directoryQuerySchema = z.strictObject({
  search: z.string().trim().min(1).max(100).optional(),
  orgUnitId: z.uuid().optional(),
  positionId: z.uuid().optional(),
  businessUnitId: z.uuid().optional(),
  jobLevelId: z.uuid().optional(),
  managerId: z.uuid().optional(),
  status: z.enum(USER_STATUS_VALUES).optional(),
  /** Situação do vínculo (dado de RH): exige people.profile.read_full na empresa toda. */
  employmentStatus: z.enum(["active", "on_leave", "terminated"]).optional(),
  sort: z.enum(DIRECTORY_SORTS).default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().pipe(z.union(DIRECTORY_PAGE_SIZES.map((n) => z.literal(n)))).default(10),
});
export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;

/** Exportação: os mesmos filtros (sem paginação) ou uma seleção de até 500 pessoas. */
export const directoryExportSchema = directoryQuerySchema.omit({ page: true, perPage: true }).extend({
  ids: z
    .string()
    .max(500 * 37)
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).max(500))
    .optional(),
});
export type DirectoryExport = z.infer<typeof directoryExportSchema>;

const isoDate = z.iso.date();

/** Cadastro de colaborador pela gestão (people.manage). A pessoa nasce "convidada". */
export const personCreateSchema = z.strictObject({
  name: z.string().trim().min(3).max(120),
  email: z.email().trim().toLowerCase().max(254),
  hireDate: isoDate,
  orgUnitId: z.uuid(),
  positionId: z.uuid(),
  businessUnitId: z.uuid().nullable().optional(),
  jobLevelId: z.uuid().nullable().optional(),
  managerId: z.uuid().nullable().optional(),
  contractType: z.enum(["clt", "pj", "intern", "apprentice", "temporary"]).default("clt"),
  /** Envia o e-mail de convite na hora (padrão). */
  sendInvite: z.boolean().default(true),
});
export type PersonCreate = z.infer<typeof personCreateSchema>;

/** Desativar ou reativar o acesso. */
export const personStatusSchema = z.strictObject({ status: z.enum(["active", "inactive"]) });

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
