import { BookOpen, Brain, Clock3, Crown, FolderKanban, GraduationCap, HeartHandshake, Lightbulb, MessageCircleMore, MessagesSquare, Puzzle, Sparkles, Target, UserRound, UsersRound, type LucideIcon } from "lucide-react";

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

/** Situação da competência frente ao nível esperado do cargo. */
export const LEVEL = {
  developed: { label: "No nível esperado", tone: "green", bar: "bg-green-500", dot: "bg-green-500", chip: "bg-green-50 text-green-800" },
  developing: { label: "Em desenvolvimento", tone: "yellow", bar: "bg-orange-500", dot: "bg-orange-500", chip: "bg-blue-50 text-blue-700" },
  to_develop: { label: "Para evoluir", tone: "red", bar: "bg-pink-500", dot: "bg-pink-500", chip: "bg-red-50 text-red-700" },
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

/** Cor de cada competência (pelo ícone do catálogo): fundo do ícone, ícone e selo de conquista. */
export const COMPETENCY_TONE: Record<string, { tile: string; icon: string; badge: string }> = {
  crown: { tile: "bg-purple-100", icon: "text-purple-600", badge: "purple" },
  people: { tile: "bg-green-100", icon: "text-green-700", badge: "green" },
  chat: { tile: "bg-pink-100", icon: "text-pink-700", badge: "pink" },
  target: { tile: "bg-orange-100", icon: "text-orange-700", badge: "orange" },
  lightbulb: { tile: "bg-yellow-100", icon: "text-yellow-700", badge: "yellow" },
  clock: { tile: "bg-blue-100", icon: "text-blue-700", badge: "blue" },
  heart: { tile: "bg-pink-100", icon: "text-pink-700", badge: "pink" },
  puzzle: { tile: "bg-blue-100", icon: "text-blue-700", badge: "blue" },
  brain: { tile: "bg-purple-100", icon: "text-purple-600", badge: "purple" },
};
export const competencyTone = (icon: string | null | undefined) => COMPETENCY_TONE[icon ?? ""] ?? COMPETENCY_TONE.crown!;

export const ACTION_TYPE_ICON: Record<string, LucideIcon> = {
  curso: GraduationCap,
  mentoria: UsersRound,
  projeto: FolderKanban,
  leitura: BookOpen,
  pratica: UserRound,
  feedback: MessagesSquare,
  outro: Sparkles,
};

/** Situação exibida de uma ação: "atrasada" é derivada (prazo vencido e ainda aberta). */
export type ActionDisplayStatus = "done" | "late" | "in_progress" | "not_started" | "cancelled";
export function displayStatus(action: { status: string; late: boolean }): ActionDisplayStatus {
  if (action.status === "done" || action.status === "cancelled") return action.status;
  if (action.late) return "late";
  return action.status === "in_progress" ? "in_progress" : "not_started";
}

export const DISPLAY_STATUS: Record<ActionDisplayStatus, { label: string; chip: string }> = {
  done: { label: "Concluída", chip: "bg-green-50 text-green-800" },
  in_progress: { label: "Em andamento", chip: "bg-purple-100 text-purple-700" },
  late: { label: "Atrasada", chip: "bg-red-50 text-red-700" },
  not_started: { label: "Não iniciada", chip: "bg-neutral-100 text-neutral-700" },
  cancelled: { label: "Cancelada", chip: "bg-neutral-100 text-neutral-500 line-through" },
};

/** Nome do nível de proficiência (1–5), na escala usada nas avaliações. */
export function levelName(level: number) {
  return PROFICIENCY_SCALE[Math.max(0, Math.min(4, level - 1))]!.label;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
/** "2026-06" → "Jun" (curto) ou "Jun/2026" (longo). */
export function monthName(month: string, long = false) {
  const [y, m] = month.split("-");
  const name = MONTHS[Number(m) - 1] ?? month;
  return long ? `${name}/${y}` : name;
}
