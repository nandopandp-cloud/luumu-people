import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "../cn";

/**
 * Abas de navegação por URL (estado compartilhável e com histórico).
 * `soft`: blocos claros; a aba atual fica branca, em roxo e sublinhada.
 */
export function LinkTabs({
  items,
  current,
  label,
  variant = "solid",
  className,
}: {
  items: { href: ComponentProps<typeof Link>["href"]; label: string; value: string }[];
  current: string;
  label: string;
  variant?: "solid" | "soft";
  className?: string;
}) {
  if (variant === "soft") {
    return (
      <nav aria-label={label} className={className}>
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {items.map((item) => {
            const active = item.value === current;
            return (
              <li key={item.value} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-12 items-center whitespace-nowrap rounded-lg px-5 text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                    active ? "bg-white font-semibold text-purple-600 shadow-sm ring-1 ring-line" : "bg-neutral-100/80 font-medium text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
                  )}
                >
                  {item.label}
                  {active ? <span aria-hidden className="absolute inset-x-4 bottom-0 h-[3px] rounded-full bg-purple-500" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => {
          const active = item.value === current;
          return (
            <li key={item.value}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-5 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                  active ? "bg-purple-500 text-white shadow-[0_6px_16px_-6px_rgb(124_58_237/0.55)]" : "bg-neutral-100/80 text-neutral-600 hover:bg-purple-50 hover:text-purple-600",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
