import type { ComponentProps } from "react";
import { cn } from "../cn";

const sizes = { xs: "size-6 text-[10px]", sm: "size-8 text-caption", md: "size-10 text-body-sm", lg: "size-12 text-body", xl: "size-32 text-h1" } as const;

/** Tons do fallback com iniciais, derivados do nome (estável por pessoa). */
const tones = ["bg-purple-100 text-purple-600", "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700"];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function toneFor(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tones[hash % tones.length];
}

export function Avatar({ name, src, size = "md", className, ...props }: { name: string; src?: string | null; size?: keyof typeof sizes } & Omit<ComponentProps<"span">, "children">) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-white", sizes[size], !src && toneFor(name), className)} {...props}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatares vêm de URLs assinadas do storage
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function AvatarGroup({ people, max = 3, size = "md" }: { people: { name: string; src?: string | null }[]; max?: number; size?: keyof typeof sizes }) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;
  return (
    <span className="flex items-center -space-x-2.5">
      {visible.map((p) => (
        <Avatar key={p.name} name={p.name} src={p.src} size={size} />
      ))}
      {rest > 0 ? (
        <span className={cn("relative inline-flex items-center justify-center rounded-full bg-purple-500 font-semibold text-white ring-2 ring-white", sizes[size])} aria-label={`e mais ${rest} pessoas`}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
