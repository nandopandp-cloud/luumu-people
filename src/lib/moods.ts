/**
 * Sentimentos do dia ("Como você está se sentindo hoje?"): escala de 6 níveis,
 * cada um com a sua ameixa (public/brand/moods/<slug>.svg). Compartilhado entre
 * servidor e interface; valor 6 = muito bem, 1 = muito mal.
 */

export type MoodValue = 1 | 2 | 3 | 4 | 5 | 6;

export type Mood = {
  value: MoodValue;
  slug: string;
  label: string;
  /** Complemento de "Hoje você está se sentindo …". */
  phrase: string;
  /** Fundo do cartão no modal e cor do selo (tokens do design system). */
  card: string;
  pill: string;
};

export const MOODS: readonly Mood[] = [
  { value: 6, slug: "muito-bem", label: "Muito bem", phrase: "muito bem!", card: "from-green-100 to-green-50", pill: "bg-green-100 text-green-800" },
  { value: 5, slug: "bem", label: "Bem", phrase: "bem!", card: "from-green-50 to-white", pill: "bg-green-50 text-green-800" },
  { value: 4, slug: "mais-ou-menos", label: "Mais ou menos", phrase: "mais ou menos.", card: "from-yellow-100 to-orange-50", pill: "bg-yellow-100 text-yellow-800" },
  { value: 3, slug: "nao-muito-bem", label: "Não muito bem", phrase: "não muito bem.", card: "from-orange-100 to-orange-50", pill: "bg-orange-100 text-orange-700" },
  { value: 2, slug: "mal", label: "Mal", phrase: "mal.", card: "from-pink-100 to-pink-50", pill: "bg-pink-100 text-pink-700" },
  { value: 1, slug: "muito-mal", label: "Muito mal", phrase: "muito mal.", card: "from-purple-100 to-purple-50", pill: "bg-red-50 text-red-700" },
];

export const MOOD_NOTE_MAX = 300;

export function moodOf(value: number | null | undefined): Mood | null {
  return MOODS.find((m) => m.value === value) ?? null;
}

export const moodArt = (slug: string) => `/brand/moods/${slug}.svg`;

/** "Hoje você está se sentindo bem! 💜" (você) ou "Hoje está se sentindo bem! 💜" (outra pessoa). */
export function moodSentence(mood: Mood, who: "you" | "they" = "you") {
  return `Hoje ${who === "you" ? "você está" : "está"} se sentindo ${mood.phrase}`;
}

/** Dia corrente no horário de Brasília (AAAA-MM-DD): o sentimento vale por dia. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
