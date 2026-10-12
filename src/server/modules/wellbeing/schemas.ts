import { z } from "zod";
import { MOOD_NOTE_MAX } from "@/lib/moods";

/** Sentimento do dia: 1 (muito mal) a 6 (muito bem) e comentário opcional. */
export const moodInputSchema = z.strictObject({
  mood: z.number().int().min(1).max(6),
  note: z
    .string()
    .trim()
    .max(MOOD_NOTE_MAX, `Use até ${MOOD_NOTE_MAX} caracteres.`)
    .nullish()
    .transform((v) => v || null),
});
export type MoodInput = z.infer<typeof moodInputSchema>;
