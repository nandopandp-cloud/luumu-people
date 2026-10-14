"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/design-system/components/select";

/** Período da "Visão da plataforma": troca o `?periodo=` sem rolar a página. */
export function UsagePeriodSelect({ value, options }: { value: number; options: readonly number[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Select
      aria-label="Período da visão da plataforma"
      value={value}
      disabled={pending}
      className="h-9 text-body-sm"
      onChange={(e) => {
        const next = Number(e.target.value);
        startTransition(() => router.replace((next === options[0] ? "/gestao" : `/gestao?periodo=${next}`) as Route, { scroll: false }));
      }}
    >
      {options.map((days) => (
        <option key={days} value={days}>
          Últimos {days} dias
        </option>
      ))}
    </Select>
  );
}
