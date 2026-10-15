"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "../cn";
import { Select } from "./select";

/**
 * Paginação numerada e cabeçalho ordenável com estado na URL (link
 * compartilhável, voltar funciona). Para listas paginadas no servidor.
 */

const num = new Intl.NumberFormat("pt-BR");

/** Páginas visíveis: 1 … 4 5 [6] 7 8 … 125 */
export function pageList(page: number, last: number): (number | "…")[] {
  const set = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
  if (page <= 3) [2, 3, 4, 5].forEach((p) => p <= last && set.add(p));
  if (page >= last - 2) [last - 4, last - 3, last - 2, last - 1].forEach((p) => p >= 1 && set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function LinkPagination({
  page,
  perPage,
  total,
  pageSizes,
  hrefForPage,
  hrefForSize,
  noun = ["resultado", "resultados"],
}: {
  page: number;
  perPage: number;
  total: number;
  pageSizes: readonly number[];
  hrefForPage: (page: number) => string;
  hrefForSize: (size: number) => string;
  /** Rótulo do total: [singular, plural]. */
  noun?: [string, string];
}) {
  const router = useRouter();
  const last = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const step = "inline-flex size-9 items-center justify-center rounded-lg border border-line bg-white text-neutral-700 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500";
  const disabled = cn(step, "pointer-events-none opacity-40");
  return (
    <nav aria-label="Paginação" className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="text-body-sm text-neutral-600" aria-live="polite">
        Mostrando {num.format(from)}–{num.format(to)} de {num.format(total)} {total === 1 ? noun[0] : noun[1]}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-caption text-neutral-600">
          Itens por página
          <Select className="h-9 w-20 text-body-sm" value={perPage} onChange={(e) => router.replace(hrefForSize(Number(e.target.value)) as Route, { scroll: false })}>
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <ul className="flex items-center gap-1.5">
          <li>
            {page > 1 ? (
              <Link href={hrefForPage(page - 1) as Route} scroll={false} className={step} aria-label="Página anterior">
                <ChevronLeft aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={disabled} aria-hidden>
                <ChevronLeft className="size-4" />
              </span>
            )}
          </li>
          {pageList(page, last).map((p, i) =>
            p === "…" ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-neutral-500">
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={hrefForPage(p) as Route}
                  scroll={false}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Página ${p}`}
                  className={cn(
                    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-body-sm tabular-nums focus-visible:outline-2 focus-visible:outline-purple-500",
                    p === page ? "bg-purple-500 font-semibold text-white" : "text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
                  )}
                >
                  {p}
                </Link>
              </li>
            ),
          )}
          <li>
            {page < last ? (
              <Link href={hrefForPage(page + 1) as Route} scroll={false} className={step} aria-label="Próxima página">
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            ) : (
              <span className={disabled} aria-hidden>
                <ChevronRight className="size-4" />
              </span>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}

/** Cabeçalho de coluna ordenável por link (aria-sort no <th>). */
export function SortableTh({ label, active, dir, href, className }: { label: string; active: boolean; dir: "asc" | "desc"; href: string; className?: string }) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const next = active && dir === "asc" ? "desc" : "asc";
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("border-b border-line px-3 py-2.5 whitespace-nowrap", className)}>
      <Link
        href={href as Route}
        scroll={false}
        className={cn("inline-flex items-center gap-1 rounded text-caption font-semibold uppercase tracking-wide hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500", active ? "text-purple-600" : "text-neutral-500")}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">: ordenar {next === "asc" ? "em ordem crescente" : "em ordem decrescente"}</span>
      </Link>
    </th>
  );
}
