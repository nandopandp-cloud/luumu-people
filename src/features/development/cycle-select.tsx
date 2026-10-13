"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/design-system/components/menu";
import { cn } from "@/design-system/cn";

export type CycleOption = { id: string; title: string; period: string; closed: boolean; href: Route };

/** Ciclo do PDI exibido (o ativo por padrão; os encerrados ficam só para consulta). */
export function CycleSelect({ options, currentId }: { options: CycleOption[]; currentId: string }) {
  const current = options.find((o) => o.id === currentId) ?? options[0];
  if (!current) return null;
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Ciclo do PDI: ${current.title}, ${current.period}. Trocar ciclo`}
          className="inline-flex h-14 items-center gap-3 rounded-xl border border-line bg-white px-3 pr-4 text-left shadow-sm transition-colors hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
        >
          <span aria-hidden className="flex size-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-body-sm font-bold text-neutral-900">{current.title}</span>
            <span className="block text-caption text-neutral-600">{current.period}</span>
          </span>
          <ChevronDown aria-hidden className="ml-2 size-4 text-neutral-500" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="min-w-64">
        <MenuLabel>Ciclos do PDI</MenuLabel>
        {options.map((o) => (
          <MenuItem key={o.id} asChild>
            <Link href={o.href} aria-current={o.id === current.id ? "page" : undefined} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {o.title}
                  {o.closed ? <span className="ml-1.5 text-caption font-normal text-neutral-600">(encerrado)</span> : null}
                </span>
                <span className="block text-caption text-neutral-600">{o.period}</span>
              </span>
              <Check aria-hidden className={cn("size-4 text-purple-600", o.id !== current.id && "invisible")} />
            </Link>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
