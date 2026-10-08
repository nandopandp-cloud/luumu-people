import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "../cn";

/** Abas de navegação por URL (estado compartilhável e com histórico). */
export function LinkTabs({ items, current, label }: { items: { href: ComponentProps<typeof Link>["href"]; label: string; value: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label}>
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
