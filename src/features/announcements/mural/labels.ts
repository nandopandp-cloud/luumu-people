import { BookOpen, CalendarDays, FileText, Gift, Headset, Heart, LifeBuoy, Link2, Megaphone, ShieldCheck, UsersRound, Wallet, type LucideIcon } from "lucide-react";

export const EVENT_KIND: Record<string, { label: string; tone: "purple" | "pink" | "blue" | "green" | "orange" }> = {
  evento: { label: "Evento", tone: "purple" },
  treinamento: { label: "Treinamento", tone: "pink" },
  workshop: { label: "Workshop", tone: "blue" },
  palestra: { label: "Palestra", tone: "green" },
  celebracao: { label: "Celebração", tone: "orange" },
};

export const EVENT_MODE: Record<string, string> = { online: "Online", presencial: "Presencial", hibrido: "Híbrido" };

export const QUICK_LINK_ICON: Record<string, { icon: LucideIcon; label: string }> = {
  gift: { icon: Gift, label: "Presente" },
  file: { icon: FileText, label: "Documento" },
  headset: { icon: Headset, label: "Atendimento" },
  calendar: { icon: CalendarDays, label: "Calendário" },
  heart: { icon: Heart, label: "Coração" },
  book: { icon: BookOpen, label: "Livro" },
  wallet: { icon: Wallet, label: "Carteira" },
  shield: { icon: ShieldCheck, label: "Escudo" },
  users: { icon: UsersRound, label: "Pessoas" },
  help: { icon: LifeBuoy, label: "Ajuda" },
  link: { icon: Link2, label: "Link" },
  megaphone: { icon: Megaphone, label: "Megafone" },
};

/** Fundo claro + ícone no tom escuro (contraste AA). */
export const QUICK_LINK_COLOR: Record<string, { tile: string; label: string }> = {
  purple: { tile: "bg-purple-100 text-purple-600", label: "Roxo" },
  blue: { tile: "bg-blue-100 text-blue-700", label: "Azul" },
  green: { tile: "bg-green-100 text-green-700", label: "Verde" },
  orange: { tile: "bg-orange-100 text-orange-700", label: "Laranja" },
  pink: { tile: "bg-pink-100 text-pink-700", label: "Rosa" },
  yellow: { tile: "bg-yellow-100 text-yellow-700", label: "Amarelo" },
};

const TZ = "America/Sao_Paulo";
export const eventDay = (d: Date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ }).format(d);
export const eventMonth = (d: Date) => new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ }).format(d).replace(".", "").toUpperCase();
export const eventTime = (d: Date) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
export const eventWhere = (e: { mode: string; location: string | null }) => `${EVENT_MODE[e.mode] ?? e.mode}${e.location ? ` (${e.location})` : ""}`;
