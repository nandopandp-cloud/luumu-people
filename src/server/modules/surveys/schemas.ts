import { z } from "zod";
import { QUESTION_TYPES, SURVEY_DIMENSIONS, SURVEY_KINDS } from "@/server/db/schema/surveys";

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
 * Rascunho de pesquisa. Nesta versão toda pesquisa é ANÔNIMA: pesquisas
 * identificadas (tabelas próprias + aviso na interface) são a próxima etapa.
 */
export const surveyInputSchema = z.strictObject({
  title: text(120),
  description: z.string().trim().max(600, "Use no máximo 600 caracteres.").nullish(),
  kind: z.enum(SURVEY_KINDS),
  anonymityK: z.union([z.literal(5), z.literal(7), z.literal(10)]).default(5),
  questions: z.array(questionInputSchema).min(1, "Inclua ao menos uma pergunta.").max(MAX_QUESTIONS, `Use no máximo ${MAX_QUESTIONS} perguntas.`),
});
export type SurveyInput = z.infer<typeof surveyInputSchema>;

export const launchInputSchema = z.strictObject({ closesAt: z.iso.datetime({ offset: true }) });

export const surveyParamsSchema = z.strictObject({ id: z.uuid() });

/** Respostas: id da pergunta → valor. Validadas contra as perguntas no serviço. */
export const answersInputSchema = z.strictObject({
  answers: z.record(z.uuid(), z.union([z.number().int().min(0).max(10), z.string().max(MAX_COMMENT_LENGTH)])),
});

export const resultsQuerySchema = z
  .strictObject({ dimension: z.enum(SURVEY_DIMENSIONS).optional(), bucket: z.string().trim().min(1).max(120).optional() })
  .refine((q) => !q.bucket || q.dimension, { message: "Escolha a dimensão do grupo.", path: ["bucket"] });
