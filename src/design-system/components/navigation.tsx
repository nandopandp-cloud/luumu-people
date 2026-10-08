import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../cn";

type Href = ComponentProps<typeof Link>["href"];

/** Breadcrumb — "Onde estou?". */
export function Breadcrumb({ items }: { items: { label: string; href?: Href }[] }) {
  return (
    <nav aria-label="Você está em">
      <ol className="flex flex-wrap items-center gap-1.5 text-body-sm text-neutral-600">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-purple-600 hover:underline underline-offset-4">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-neutral-800")}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight aria-hidden className="size-3.5" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Paginação por cursor (primeira/próxima) — listas grandes, sem contagem total. */
export function CursorPagination({ firstHref, nextHref, summary }: { firstHref?: Href | null; nextHref?: Href | null; summary?: ReactNode }) {
  const base = "inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-body-sm font-medium";
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4">
      <p className="text-body-sm text-neutral-500">{summary}</p>
      <div className="flex gap-2">
        {firstHref ? (
          <Link href={firstHref} className={cn(base, "text-neutral-700 hover:bg-purple-50 hover:text-purple-600")}>
            <ChevronLeft aria-hidden className="size-4" /> Primeira página
          </Link>
        ) : null}
        {nextHref ? (
          <Link href={nextHref} className={cn(base, "text-neutral-700 hover:bg-purple-50 hover:text-purple-600")}>
            Próxima <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span aria-disabled className={cn(base, "text-neutral-400")}>
            Próxima <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
