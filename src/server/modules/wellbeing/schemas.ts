import { z } from "zod";

export const MOODS = [
  { value: 5, label: "Muito bem", emoji: "😄" },
  { value: 4, label: "Bem", emoji: "🙂" },
  { value: 3, label: "Neutro", emoji: "😐" },
  { value: 2, label: "Um pouco desanimado", emoji: "🙁" },
  { value: 1, label: "Não estou bem", emoji: "😣" },
] as const;

export const moodInputSchema = z.strictObject({ mood: z.number().int().min(1).max(5) });
export type MoodInput = z.infer<typeof moodInputSchema>;
