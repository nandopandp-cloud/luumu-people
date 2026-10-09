import { BookOpen, CalendarDays, Compass, Heart, Lightbulb, Megaphone, MessageCircleMore, ShieldCheck, Sprout, Target, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import { cn } from "../cn";

/**
 * Capa ilustrada de comunicados, trilhas e cursos. Até o upload de imagens
 * (storage privado + URL assinada), cada item escolhe um TEMA e uma ILUSTRAÇÃO.
 * Decorativa: o título do item já descreve o conteúdo.
 */
export type CoverTheme = "purple" | "green" | "orange" | "blue" | "pink" | "yellow";
export type CoverIllustration = "megaphone" | "people" | "plant" | "shield" | "heart" | "calendar" | "trophy" | "book" | "target" | "lightbulb" | "chat" | "compass";

export const COVER_ICONS: Record<CoverIllustration, LucideIcon> = {
  megaphone: Megaphone,
  people: UsersRound,
  plant: Sprout,
  shield: ShieldCheck,
  heart: Heart,
  calendar: CalendarDays,
  trophy: Trophy,
  book: BookOpen,
  target: Target,
  lightbulb: Lightbulb,
  chat: MessageCircleMore,
  compass: Compass,
};

const THEMES: Record<CoverTheme, { bg: string; blob: string; icon: string; accent: string }> = {
  purple: { bg: "from-[#efe8fe] via-[#e2d6fb] to-[#cdb9f6]", blob: "bg-white/45", icon: "text-purple-600", accent: "fill-purple-300" },
  green: { bg: "from-[#ecf8df] via-[#d7f0c3] to-[#b7e39b]", blob: "bg-white/50", icon: "text-green-700", accent: "fill-green-500" },
  orange: { bg: "from-[#fff1de] via-[#ffe0b8] to-[#ffc98a]", blob: "bg-white/50", icon: "text-orange-600", accent: "fill-orange-500" },
  blue: { bg: "from-[#e7f0ff] via-[#d3e3ff] to-[#b6cffd]", blob: "bg-white/50", icon: "text-blue-700", accent: "fill-blue-500" },
  pink: { bg: "from-[#fdebf3] via-[#fbd6e6] to-[#f7b9d2]", blob: "bg-white/50", icon: "text-pink-700", accent: "fill-pink-500" },
  yellow: { bg: "from-[#fff8dc] via-[#ffefb0] to-[#ffe17d]", blob: "bg-white/50", icon: "text-yellow-700", accent: "fill-yellow-500" },
};

export function CoverArt({ theme, illustration, className, iconClassName }: { theme: CoverTheme; illustration: CoverIllustration; className?: string; iconClassName?: string }) {
  const Icon = COVER_ICONS[illustration];
  const t = THEMES[theme];
  return (
    <div aria-hidden className={cn("relative isolate overflow-hidden bg-gradient-to-br", t.bg, className)}>
      <div className={cn("absolute -left-6 -top-8 size-28 rounded-full", t.blob)} />
      <div className={cn("absolute -bottom-10 right-4 size-32 rounded-full", t.blob)} />
      <svg viewBox="0 0 120 60" className="absolute bottom-0 left-0 h-1/2 w-2/5 opacity-70" preserveAspectRatio="none">
        <path d="M0 60C10 30 30 10 50 20S90 50 120 60Z" className={t.accent} opacity="0.35" />
      </svg>
      <svg viewBox="0 0 40 60" className="absolute bottom-0 right-3 h-3/5 opacity-90">
        <path d="M20 60C6 44 4 22 20 2c16 20 14 42 0 58Z" fill="#7CC639" />
        <path d="M20 60C16 44 16 22 20 2c16 20 14 42 0 58Z" fill="#4E9F2E" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={cn("size-16 drop-shadow-[0_6px_10px_rgb(76_29_149/0.18)]", t.icon, iconClassName)} strokeWidth={1.6} />
      </div>
    </div>
  );
}
