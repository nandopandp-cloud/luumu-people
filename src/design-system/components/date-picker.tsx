"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../cn";
import { controlBase, controlState } from "./field";

/**
 * Seletor de data — styleguide "05. Date picker". Valor em ISO (aaaa-mm-dd),
 * exibição dd/mm/aaaa. Grade navegável por teclado (setas, PageUp/PageDown
 * troca de mês, Home/End início/fim da semana, Enter seleciona, Esc fecha).
 */
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTH = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const FULL = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });

const toIso = (d: Date) => d.toISOString().slice(0, 10);
const fromIso = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addMonths = (d: Date, n: number) => {
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(d.getUTCDate(), last));
  return r;
};
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatIsoDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type Props = {
  value: string | null;
  onChange: (iso: string | null) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
};

export function DatePicker({ value, onChange, min, max, placeholder = "dd/mm/aaaa", invalid, disabled, id, ...aria }: Props) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<string>(value ?? todayIso());
  const gridRef = useRef<HTMLTableElement>(null);

  const focusedDate = fromIso(focused);
  const monthStart = new Date(Date.UTC(focusedDate.getUTCFullYear(), focusedDate.getUTCMonth(), 1));
  const gridStart = addDays(monthStart, -monthStart.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7)).filter((week) => week.some((d) => d.getUTCMonth() === monthStart.getUTCMonth()));
  const outOfRange = (iso: string) => (min !== undefined && iso < min) || (max !== undefined && iso > max);

  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  function select(iso: string) {
    if (outOfRange(iso)) return;
    onChange(iso);
    setOpen(false);
  }

  function onKeyDown(event: KeyboardEvent) {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusedDate, -1),
      ArrowRight: () => addDays(focusedDate, 1),
      ArrowUp: () => addDays(focusedDate, -7),
      ArrowDown: () => addDays(focusedDate, 7),
      PageUp: () => addMonths(focusedDate, -1),
      PageDown: () => addMonths(focusedDate, 1),
      Home: () => addDays(focusedDate, -focusedDate.getUTCDay()),
      End: () => addDays(focusedDate, 6 - focusedDate.getUTCDay()),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFocused(toIso(move()));
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFocused(value ?? todayIso());
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          id={id}
          type="button"
          aria-haspopup="dialog"
          className={cn(controlBase, controlState(invalid), "flex h-11 items-center gap-3 px-3.5 text-left")}
          {...aria}
        >
          <CalendarDays aria-hidden className="size-[18px] text-neutral-500" />
          <span className={cn(!value && "text-neutral-500")}>{value ? formatIsoDate(value) : placeholder}</span>
          {value ? <span className="sr-only">({FULL.format(fromIso(value))})</span> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[300px] rounded-lg border border-line bg-white p-4 shadow-lg"
          aria-label="Escolher data"
          onOpenAutoFocus={(e) => {
            // O foco vai direto para o dia selecionado (ou hoje): setas já navegam.
            e.preventDefault();
            requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus());
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setFocused(toIso(addMonths(focusedDate, -1)))} className="rounded-full p-1.5 text-neutral-700 hover:bg-purple-50" aria-label="Mês anterior">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-body-sm font-semibold text-neutral-900" aria-live="polite">
              {capitalize(MONTH.format(monthStart))}
            </p>
            <button type="button" onClick={() => setFocused(toIso(addMonths(focusedDate, 1)))} className="rounded-full p-1.5 text-neutral-700 hover:bg-purple-50" aria-label="Próximo mês">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <table ref={gridRef} role="grid" className="w-full border-collapse text-center" onKeyDown={onKeyDown}>
            <thead>
              <tr>
                {WEEKDAYS.map((d, i) => (
                  <th key={i} scope="col" abbr={WEEKDAY_NAMES[i]} className="pb-2 text-caption font-medium text-neutral-500">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, w) => (
                <tr key={w}>
                  {week.map((d) => {
                    const iso = toIso(d);
                    const inMonth = d.getUTCMonth() === monthStart.getUTCMonth();
                    const isSelected = iso === value;
                    const isToday = iso === todayIso();
                    const disabledDay = outOfRange(iso);
                    return (
                      <td key={iso} className="p-0.5" role="gridcell" aria-selected={isSelected}>
                        <button
                          type="button"
                          data-date={iso}
                          tabIndex={iso === focused ? 0 : -1}
                          disabled={disabledDay}
                          aria-current={isToday ? "date" : undefined}
                          aria-label={FULL.format(d)}
                          onClick={() => select(iso)}
                          className={cn(
                            "mx-auto flex size-9 items-center justify-center rounded-full text-body-sm transition-colors focus-visible:outline-2 focus-visible:outline-purple-500",
                            inMonth ? "text-neutral-800" : "text-neutral-400",
                            isSelected ? "bg-purple-500 font-semibold text-white" : "hover:bg-purple-50",
                            isToday && !isSelected && "font-semibold text-purple-600 ring-1 ring-purple-300",
                            disabledDay && "cursor-not-allowed opacity-40 hover:bg-transparent",
                          )}
                        >
                          {d.getUTCDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between border-t border-line pt-3">
            <button type="button" className="text-caption font-medium text-neutral-600 hover:underline" onClick={() => { onChange(null); setOpen(false); }}>
              Limpar
            </button>
            <button type="button" className="text-caption font-medium text-purple-600 hover:underline" onClick={() => select(todayIso())}>
              Hoje
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
