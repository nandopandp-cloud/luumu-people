import { z } from "zod";
import { JOB_LEVEL_NAMES, POSITION_NAMES } from "@/lib/job-catalog";
import { CONTRACT_TYPES, EMPLOYMENT_STATUSES } from "@/server/db/schema/organization";

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
  /** Cargo e nível vêm de listas fixas; o cadastro da empresa é criado se ainda não existir. */
  position: z.enum(POSITION_NAMES),
  jobLevel: z.enum(JOB_LEVEL_NAMES),
  managerId: z.uuid(),
  contractType: z.enum(["clt", "pj", "intern", "apprentice", "temporary"]).default("clt"),
  /** Envia o e-mail de convite na hora (padrão). */
  sendInvite: z.boolean().default(true),
});
export type PersonCreate = z.infer<typeof personCreateSchema>;

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\d\s-]{8,20}$/, "Telefone em formato inválido");

/**
 * Edição dos dados de um colaborador pela gestão (people.manage, empresa toda).
 * Todos os campos são opcionais (só o que mudou). Cargo e nível: um já
 * cadastrado na empresa (id) ou um da lista fixa (nome). Localização: uma
 * unidade existente, uma cidade/UF nova ou nenhuma (null). Mudanças de área,
 * cargo, nível, localização e gestor(a) geram histórico (nunca sobrescrevem).
 */
export const personUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(3, "Informe o nome completo.").max(120).optional(),
    preferredName: z.string().trim().min(1).max(80).nullable().optional(),
    email: z.email("Informe um e-mail válido.").trim().toLowerCase().max(254).optional(),
    hireDate: isoDate.optional(),
    orgUnitId: z.uuid().optional(),
    positionId: z.uuid().optional(),
    position: z.enum(POSITION_NAMES).optional(),
    jobLevelId: z.uuid().optional(),
    jobLevel: z.enum(JOB_LEVEL_NAMES).optional(),
    /** null = sem gestor(a). */
    managerId: z.uuid().nullable().optional(),
    location: z
      .union([
        z.strictObject({ businessUnitId: z.uuid() }),
        z.strictObject({
          city: z.string().trim().min(2, "Informe a cidade.").max(80),
          state: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z]{2}$/, "Use a sigla do estado (ex.: SP)."),
        }),
      ])
      .nullable()
      .optional(),
    employeeCode: z.string().trim().min(1).max(40).nullable().optional(),
    contractType: z.enum(CONTRACT_TYPES).optional(),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
    phone: phoneSchema.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Informe ao menos um campo.")
  .refine((v) => !(v.positionId && v.position), { message: "Escolha um único cargo.", path: ["position"] })
  .refine((v) => !(v.jobLevelId && v.jobLevel), { message: "Escolha um único nível.", path: ["jobLevel"] });
export type PersonUpdate = z.infer<typeof personUpdateSchema>;

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
