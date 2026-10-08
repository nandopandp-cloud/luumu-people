import { z } from "zod";
import { ACTION_STATUSES, ACTION_TYPES, COMPETENCY_CATEGORIES } from "@/server/db/schema/development";

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

export const goalInputSchema = z.strictObject({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(1000).nullable().optional(),
  competencyId: z.uuid().nullable().optional(),
  targetDate: isoDate.nullable().optional(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

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
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.enum(COMPETENCY_CATEGORIES),
  icon: z.string().max(30).optional(),
});
export type CompetencyInput = z.infer<typeof competencyInputSchema>;
