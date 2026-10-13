"use client";

import {
  Bike,
  BookOpen,
  Boxes,
  Camera,
  ChartColumn,
  ChefHat,
  Clapperboard,
  CodeXml,
  Coffee,
  Crown,
  Dumbbell,
  Footprints,
  Gamepad2,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Languages,
  Lightbulb,
  MessageCircle,
  Mountain,
  Music,
  Palette,
  PawPrint,
  PenLine,
  Plane,
  type LucideIcon,
} from "lucide-react";
import { Tooltip } from "@/design-system/components/tooltip";
import { cn } from "@/design-system/cn";
import { interestOf, type InterestTone } from "@/lib/interests";

/** Ícone de cada interesse do catálogo (src/lib/interests.ts). */
const ICONS: Record<string, LucideIcon> = {
  design: Palette,
  tecnologia: CodeXml,
  dados: ChartColumn,
  produto: Boxes,
  lideranca: Crown,
  comunicacao: MessageCircle,
  educacao: GraduationCap,
  inovacao: Lightbulb,
  leitura: BookOpen,
  escrita: PenLine,
  idiomas: Languages,
  musica: Music,
  fotografia: Camera,
  cinema: Clapperboard,
  games: Gamepad2,
  esportes: Dumbbell,
  corrida: Footprints,
  ciclismo: Bike,
  natureza: Mountain,
  viagens: Plane,
  culinaria: ChefHat,
  cafe: Coffee,
  "bem-estar": HeartPulse,
  voluntariado: HandHeart,
  pets: PawPrint,
};

/** Fundo claro + ícone no tom escuro (contraste AA). */
export const TONE: Record<InterestTone, string> = {
  purple: "bg-purple-100 text-purple-600",
  pink: "bg-pink-100 text-pink-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  yellow: "bg-yellow-100 text-yellow-800",
};

/** Ícone do interesse (decorativo). */
export function InterestGlyph({ interest, className }: { interest: string; className?: string }) {
  const Icon = ICONS[interest] ?? Lightbulb;
  return <Icon aria-hidden className={className} />;
}

/** Bolinha com o ícone do interesse (nome no hover e para leitores de tela). */
export function InterestDot({ interest, size = "sm" }: { interest: string; size?: "sm" | "md" }) {
  const meta = interestOf(interest);
  if (!meta) return null;
  return (
    <Tooltip content={meta.label}>
      <span tabIndex={0} className={cn("inline-flex shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-purple-500", TONE[meta.tone], size === "sm" ? "size-6" : "size-8")}>
        <InterestGlyph interest={interest} className={size === "sm" ? "size-3.5" : "size-4"} />
        <span className="sr-only">{meta.label}</span>
      </span>
    </Tooltip>
  );
}

/** Chip com ícone e nome do interesse. */
export function InterestChip({ interest, className }: { interest: string; className?: string }) {
  const meta = interestOf(interest);
  if (!meta) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-caption font-semibold", TONE[meta.tone], className)}>
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-white/70">
        <InterestGlyph interest={interest} className="size-3.5" />
      </span>
      {meta.label}
    </span>
  );
}
