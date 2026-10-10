"use client";

import { Filter } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { cn } from "@/design-system/cn";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";

/** Botão "Filtros" da lista da gestão: hoje, a categoria (mantém aba e busca). */
export function ManagedFilters({ category, baseQuery }: { category: string; baseQuery: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(category);

  function apply(next: string) {
    const query = new URLSearchParams(baseQuery);
    if (next) query.set("categoria", next);
    setOpen(false);
    const qs = query.toString();
    router.push(`/gestao/comunicacao${qs ? `?${qs}` : ""}` as Route, { scroll: false });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border bg-white px-5 text-body-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
          category ? "border-purple-500 text-purple-600" : "border-line",
        )}
      >
        <Filter aria-hidden className="size-4" /> Filtros
        {category ? <span className="rounded-full bg-purple-500 px-1.5 text-caption text-white">1</span> : null}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Filtrar comunicados"
        footer={
          <>
            <Button variant="ghost" onClick={() => apply("")}>
              Limpar
            </Button>
            <Button onClick={() => apply(value)}>Aplicar</Button>
          </>
        }
      >
        <Field label="Categoria">
          {(f) => (
            <Select id={f.id} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ANNOUNCEMENT_CATEGORY).map(([v, c]) => (
                <option key={v} value={v}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Modal>
    </>
  );
}
