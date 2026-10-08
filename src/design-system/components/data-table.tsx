"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";
import { Table, Td, Th, THead, Tr } from "./table";

/**
 * Tabela de dados com ordenação e paginação NO CLIENTE — para conjuntos
 * pequenos já filtrados pelo servidor. Listas grandes devem paginar no
 * servidor (cursor) e usar <Table> diretamente.
 */
export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valor usado na ordenação; ausente = coluna não ordenável. */
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
};

type Sort = { key: string; direction: "asc" | "desc" } | null;
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  pageSize = 10,
  initialSort = null,
  empty = "Nenhum registro encontrado.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  pageSize?: number;
  initialSort?: Sort;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<Sort>(initialSort);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (typeof va === "number" && typeof vb === "number" ? va - vb : collator.compare(String(va), String(vb))) * factor;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  function toggle(key: string) {
    setPage(0);
    setSort((s) => (s?.key !== key ? { key, direction: "asc" } : s.direction === "asc" ? { key, direction: "desc" } : null));
  }

  if (rows.length === 0) return <p className="py-8 text-center text-body-sm text-neutral-500">{empty}</p>;

  return (
    <div>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <THead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
              return (
                <Th key={c.key} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined} className={cn(c.align === "right" && "text-right")}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-neutral-900", active && "text-neutral-900")}>
                      {c.header}
                      <Icon aria-hidden className="size-3.5" />
                    </button>
                  ) : (
                    c.header
                  )}
                </Th>
              );
            })}
          </tr>
        </THead>
        <tbody>
          {visible.map((row) => (
            <Tr key={rowKey(row)}>
              {columns.map((c) => (
                <Td key={c.key} data-label={c.header} className={cn(c.align === "right" && "md:text-right")}>
                  {c.cell(row)}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
      {pages > 1 ? (
        <nav aria-label="Paginação da tabela" className="mt-4 flex items-center justify-between gap-3">
          <p className="text-caption text-neutral-500">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} de {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-full p-2 text-neutral-700 hover:bg-purple-50 disabled:opacity-40" aria-label="Página anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                aria-current={i === current ? "page" : undefined}
                className={cn("min-w-9 rounded-md px-2 py-1.5 text-body-sm", i === current ? "bg-purple-500 font-semibold text-white" : "text-neutral-700 hover:bg-purple-50")}
              >
                {i + 1}
              </button>
            ))}
            <button type="button" disabled={current === pages - 1} onClick={() => setPage(current + 1)} className="rounded-full p-2 text-neutral-700 hover:bg-purple-50 disabled:opacity-40" aria-label="Próxima página">
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
