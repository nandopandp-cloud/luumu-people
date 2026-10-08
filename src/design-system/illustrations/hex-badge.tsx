import { Crown, Leaf, MessageCircleMore, Star, Trophy, UsersRound, type LucideIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "../cn";

/** Selo hexagonal de conquista (mockups "Minhas conquistas"). */
const ICONS: Record<string, LucideIcon> = { star: Star, leaf: Leaf, people: UsersRound, crown: Crown, chat: MessageCircleMore, trophy: Trophy };

const GRADIENTS: Record<string, [string, string]> = {
  purple: ["#c4b5fd", "#8b5cf6"],
  green: ["#86d76a", "#2f9e44"],
  orange: ["#fdba74", "#f97316"],
  blue: ["#7cc4fa", "#1d74e8"],
  pink: ["#f9a8d4", "#e0457b"],
  yellow: ["#fde68a", "#f2b705"],
};

export function HexBadge({ icon, theme, className, locked }: { icon: string; theme: string; className?: string; locked?: boolean }) {
  const id = useId();
  const [from, to] = locked ? ["#e5e7eb", "#9ca3af"] : (GRADIENTS[theme] ?? GRADIENTS.purple!);
  const Icon = ICONS[icon] ?? Star;
  return (
    <span aria-hidden className={cn("relative inline-flex size-14 items-center justify-center", className)}>
      <svg viewBox="0 0 56 62" className="absolute inset-0 size-full drop-shadow-[0_6px_10px_rgb(76_29_149/0.18)]">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <path d="M28 2c1.6 0 3.2.4 4.6 1.2l17.8 10.3c2.8 1.6 4.6 4.6 4.6 7.9v20.6c0 3.3-1.8 6.3-4.6 7.9L32.6 60.2a9.2 9.2 0 0 1-9.2 0L5.6 49.9C2.8 48.3 1 45.3 1 42V21.4c0-3.3 1.8-6.3 4.6-7.9L23.4 3.2C24.8 2.4 26.4 2 28 2Z" fill={`url(#${id})`} />
        <path d="M28 7.5 49 19.6v.6L28 8.1 7 20.2v-.6Z" fill="#fff" opacity=".35" />
      </svg>
      <Icon className="relative size-6 text-white" strokeWidth={2.4} fill="currentColor" fillOpacity={0.25} />
    </span>
  );
}
