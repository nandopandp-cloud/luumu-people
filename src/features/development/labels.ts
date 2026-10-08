import { Brain, Clock3, Crown, HeartHandshake, Lightbulb, MessageCircleMore, Puzzle, Target, UsersRound, type LucideIcon } from "lucide-react";

export const COMPETENCY_ICONS: Record<string, LucideIcon> = {
  chat: MessageCircleMore,
  people: UsersRound,
  crown: Crown,
  target: Target,
  clock: Clock3,
  heart: HeartHandshake,
  lightbulb: Lightbulb,
  puzzle: Puzzle,
  brain: Brain,
};

export const CATEGORY_LABEL: Record<string, string> = { comportamental: "Comportamental", tecnica: "Técnica", lideranca: "Liderança" };

export const LEVEL = {
  developed: { label: "Desenvolvida", tone: "green", bar: "bg-green-500", dot: "bg-green-500" },
  developing: { label: "Em desenvolvimento", tone: "yellow", bar: "bg-orange-500", dot: "bg-orange-500" },
  to_develop: { label: "A desenvolver", tone: "red", bar: "bg-pink-500", dot: "bg-pink-500" },
} as const;

export const SOURCE_LABEL: Record<string, string> = { self: "Autoavaliação", manager: "Avaliação do gestor", people: "Avaliação de G&G" };

export function formatDay(iso: string | null | undefined) {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const ACTION_TYPE_LABEL: Record<string, string> = {
  curso: "Curso",
  mentoria: "Mentoria",
  projeto: "Projeto",
  leitura: "Leitura",
  pratica: "Prática",
  feedback: "Feedback",
  outro: "Outro",
};

export const ACTION_STATUS_LABEL: Record<string, string> = {
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  done: "Concluída",
  cancelled: "Cancelada",
};

/** Escala amigável (1–5) ↔ pontuação 0–100. */
export const PROFICIENCY_SCALE = [
  { score: 20, label: "Iniciante" },
  { score: 40, label: "Em formação" },
  { score: 60, label: "Proficiente" },
  { score: 80, label: "Avançado" },
  { score: 100, label: "Referência" },
] as const;
