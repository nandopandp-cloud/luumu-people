import { z } from "zod";
import { ACTION_STATUSES, ACTION_TYPES, COMPETENCY_CATEGORIES, GOAL_TAG_MAX_LENGTH, GOAL_TAGS_MAX, PDI_MENTOR_NOTE_MAX } from "@/server/db/schema/development";

const isoDate = z.iso.date();
const httpsUrl = z.url({ protocol: /^https$/, hostname: z.regexes.domain }).max(500);

export const pdiInputSchema = z
  .strictObject({
    userId: z.uuid().optional(),
    title: z.string().trim().min(3).max(120),
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: "O fim do período deve ser depois do início.", path: ["periodEnd"] });
export type PdiInput = z.infer<typeof pdiInputSchema>;

/** Etiquetas do objetivo: sem repetição (ignorando maiúsculas) e no máximo GOAL_TAGS_MAX. */
const goalTags = z
  .array(z.string().trim().min(1).max(GOAL_TAG_MAX_LENGTH, `Use no máximo ${GOAL_TAG_MAX_LENGTH} caracteres por etiqueta.`))
  .transform((tags) => tags.filter((tag, i) => tags.findIndex((other) => other.toLocaleLowerCase("pt-BR") === tag.toLocaleLowerCase("pt-BR")) === i))
  .pipe(z.array(z.string()).max(GOAL_TAGS_MAX, `Use no máximo ${GOAL_TAGS_MAX} etiquetas.`));

const goalFields = {
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).nullable().optional(),
  competencyId: z.uuid().nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  tags: goalTags.optional(),
};

export const goalInputSchema = z.strictObject(goalFields);
export type GoalInput = z.infer<typeof goalInputSchema>;

export const goalUpdateSchema = z
  .strictObject({ ...goalFields, title: goalFields.title.optional() })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo.");
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;

/** Mentoria do ciclo: quem acompanha (colega ativo, nunca a própria pessoa) e uma mensagem. */
export const pdiMentorSchema = z.strictObject({
  mentorUserId: z.uuid().nullable(),
  mentorNote: z.string().trim().max(PDI_MENTOR_NOTE_MAX, `Use no máximo ${PDI_MENTOR_NOTE_MAX} caracteres.`).nullable().optional(),
});
export type PdiMentorInput = z.infer<typeof pdiMentorSchema>;

export const actionInputSchema = z.strictObject({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).nullable().optional(),
  type: z.enum(ACTION_TYPES).default("pratica"),
  dueDate: isoDate.nullable().optional(),
  ownerUserId: z.uuid().optional(),
});
export type ActionInput = z.infer<typeof actionInputSchema>;

export const actionUpdateSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    type: z.enum(ACTION_TYPES).optional(),
    dueDate: isoDate.nullable().optional(),
    status: z.enum(ACTION_STATUSES).optional(),
    evidence: z.string().trim().max(2000).nullable().optional(),
    evidenceUrl: httpsUrl.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo.");
export type ActionUpdate = z.infer<typeof actionUpdateSchema>;

export const assessmentInputSchema = z.strictObject({
  userId: z.uuid().optional(),
  competencyId: z.uuid(),
  score: z.number().int().min(0).max(100),
  note: z.string().trim().max(1000).nullable().optional(),
});
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;

export const competencyInputSchema = z.strictObject({
  /** Pessoa cujo desenvolvimento a liderança está vendo (gestor com escopo de equipe). */
  userId: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.enum(COMPETENCY_CATEGORIES),
  icon: z.string().max(30).optional(),
});
export type CompetencyInput = z.infer<typeof competencyInputSchema>;
