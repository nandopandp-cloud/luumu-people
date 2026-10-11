"use client";

import { ArrowDownWideNarrow } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

/** Ordem da lista de pesquisas respondidas (estado na URL). */
export function SortSelect({ value }: { value: "recentes" | "antigas" }) {
  const router = useRouter();
  return (
    <div className="relative">
      <label htmlFor="ordem-respondidas" className="sr-only">
        Ordenar pesquisas respondidas
      </label>
      <select
        id="ordem-respondidas"
        value={value}
        onChange={(e) => router.push((e.target.value === "antigas" ? "/pesquisas?ordem=antigas" : "/pesquisas") as Route, { scroll: false })}
        className="h-10 appearance-none rounded-md border border-line bg-white pl-4 pr-10 text-body-sm font-medium text-neutral-800 hover:border-neutral-300 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-100"
      >
        <option value="recentes">Mais recentes primeiro</option>
        <option value="antigas">Mais antigas primeiro</option>
      </select>
      <ArrowDownWideNarrow aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-600" />
    </div>
  );
}
