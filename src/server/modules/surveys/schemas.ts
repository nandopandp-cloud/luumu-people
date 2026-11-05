import { z } from "zod";
import { ANONYMITY_MODES, QUESTION_TYPES, SURVEY_DIMENSIONS, SURVEY_KINDS } from "@/server/db/schema/surveys";

const text = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max, `Use no máximo ${max} caracteres.`);

export const MAX_QUESTIONS = 40;
export const MAX_COMMENT_LENGTH = 2000;

export const questionInputSchema = z
  .strictObject({
    type: z.enum(QUESTION_TYPES),
    text: text(300),
    options: z.array(text(120)).min(2, "Inclua ao menos 2 opções.").max(12, "Use no máximo 12 opções.").nullish(),
    required: z.boolean().default(true),
  })
  .refine((q) => (q.type === "choice") === Boolean(q.options?.length), { message: "Somente perguntas de múltipla escolha têm opções.", path: ["options"] });

/**
 * Rascunho de pesquisa. Quem cria escolhe a privacidade: ANÔNIMA (cofre) ou
 * IDENTIFICADA (com nome, só para G&G), e se é LIVRE (sem mínimo de público nem
 * de respostas por grupo). Identificada é sempre livre.
 */
export const surveyInputSchema = z.strictObject({
  title: text(120),
  description: z.string().trim().max(600, "Use no máximo 600 caracteres.").nullish(),
  kind: z.enum(SURVEY_KINDS),
  anonymityMode: z.enum(ANONYMITY_MODES).default("anonymous"),
  noMinimum: z.boolean().default(false),
  anonymityK: z.union([z.literal(5), z.literal(7), z.literal(10)]).default(5),
  questions: z.array(questionInputSchema).min(1, "Inclua ao menos uma pergunta.").max(MAX_QUESTIONS, `Use no máximo ${MAX_QUESTIONS} perguntas.`),
});
export type SurveyInput = z.infer<typeof surveyInputSchema>;

/** Pesquisa lançada: só título, descrição e prazo mudam. */
export const surveyDetailsSchema = z
  .strictObject({ title: text(120).optional(), description: z.string().trim().max(600, "Use no máximo 600 caracteres.").nullish(), closesAt: z.iso.datetime({ offset: true }).optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Informe ao menos um campo.");
export type SurveyDetailsInput = z.infer<typeof surveyDetailsSchema>;

export const resumeInputSchema = z.strictObject({ closesAt: z.iso.datetime({ offset: true }).optional() });

export const MAX_AUDIENCE_UNITS = 50;

/** Lançamento: prazo, início (agora ou agendado) e público (empresa toda ou áreas específicas, com subáreas). */
export const launchInputSchema = z.strictObject({
  closesAt: z.iso.datetime({ offset: true }),
  opensAt: z.iso.datetime({ offset: true }).optional(),
  /** Vazio ou ausente = empresa toda. */
  audienceOrgUnitIds: z.array(z.uuid()).max(MAX_AUDIENCE_UNITS, `Escolha no máximo ${MAX_AUDIENCE_UNITS} áreas.`).optional(),
});
export type LaunchInput = z.infer<typeof launchInputSchema>;

/** Áreas separadas por vírgula; ausente = empresa toda. */
export const audienceQuerySchema = z.strictObject({
  orgUnitIds: z
    .string()
    .max(MAX_AUDIENCE_UNITS * 37)
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(z.uuid()).max(MAX_AUDIENCE_UNITS))
    .optional(),
});

export const surveyParamsSchema = z.strictObject({ id: z.uuid() });

/** Respostas: id da pergunta → valor. Validadas contra as perguntas no serviço. */
export const answersInputSchema = z.strictObject({
  answers: z.record(z.uuid(), z.union([z.number().int().min(0).max(10), z.string().max(MAX_COMMENT_LENGTH)])),
});

export const resultsQuerySchema = z
  .strictObject({ dimension: z.enum(SURVEY_DIMENSIONS).optional(), bucket: z.string().trim().min(1).max(120).optional() })
  .refine((q) => !q.bucket || q.dimension, { message: "Escolha a dimensão do grupo.", path: ["bucket"] });
