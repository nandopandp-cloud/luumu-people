"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../cn";
import { Avatar } from "./avatar";

/**
 * Select com busca e seleção múltipla (chips) — styleguide "02. Selects e
 * multiselects". Lista com semântica de listbox, navegação por setas, Enter
 * seleciona, Esc fecha. Com `multiple`, os escolhidos aparecem como chips.
 */
export type ComboboxOption = { value: string; label: string; description?: string; avatar?: { name: string; src?: string | null } };

type Props = {
  options: ComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
  /** Nome acessível quando não houver <label htmlFor>. */
  "aria-label"?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  multiple = false,
  searchable = true,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar…",
  emptyText = "Nenhum resultado encontrado.",
  invalid,
  disabled,
  id,
  ...aria
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return q ? options.filter((o) => `${o.label} ${o.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(q)) : options;
  }, [options, query]);

  const selected = options.filter((o) => value.includes(o.value));

  function toggle(option: ComboboxOption) {
    if (multiple) {
      onChange(value.includes(option.value) ? value.filter((v) => v !== option.value) : [...value, option.value]);
    } else {
      onChange([option.value]);
      setOpen(false);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && filtered[active]) {
      event.preventDefault();
      toggle(filtered[active]);
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <Popover.Anchor asChild>
      <div
        className={cn(
          "flex min-h-11 w-full items-center gap-1.5 rounded-md border bg-white py-1.5 pl-2 pr-1 text-body-sm transition-[border-color,box-shadow]",
          invalid ? "border-red-500" : "border-neutral-200 hover:border-neutral-300",
          open && "border-purple-500 ring-4 ring-purple-100",
          disabled && "cursor-not-allowed bg-neutral-100 text-neutral-400",
        )}
      >
        {multiple && selected.length > 0 ? (
          <ul className="flex flex-1 flex-wrap gap-1.5" aria-label="Selecionados">
            {selected.map((o) => (
              <li key={o.value} className="inline-flex items-center gap-1 rounded-full bg-purple-100 py-0.5 pl-2.5 pr-1 text-caption font-medium text-purple-700">
                {o.label}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((v) => v !== o.value))}
                  className="rounded-full p-0.5 hover:bg-purple-200"
                  aria-label={`Remover ${o.label}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Popover.Trigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-invalid={invalid || undefined}
            className={cn("flex min-w-0 flex-1 items-center justify-between gap-2 rounded-sm px-1.5 py-1 text-left focus:outline-none", multiple && selected.length > 0 && "flex-none")}
            {...aria}
          >
            <span className={cn("truncate", (multiple ? selected.length === 0 : !selected[0]) && "text-neutral-500")}>
              {multiple ? (selected.length === 0 ? placeholder : <span className="sr-only">{`${selected.length} selecionados`}</span>) : (selected[0]?.label ?? placeholder)}
            </span>
            <ChevronDown aria-hidden className="size-4 shrink-0 text-neutral-500" />
          </button>
        </Popover.Trigger>
      </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popper-anchor-width)] min-w-64 rounded-lg border border-line bg-white p-1.5 shadow-lg"
          onOpenAutoFocus={(e) => {
            if (!searchable) {
              e.preventDefault();
              listRef.current?.focus();
            }
          }}
        >
          {searchable ? (
            <div className="relative mb-1">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].value}` : undefined}
                className="h-10 w-full rounded-md bg-neutral-50 pl-9 pr-3 text-body-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
          ) : null}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            tabIndex={searchable ? -1 : 0}
            onKeyDown={searchable ? undefined : onKeyDown}
            aria-activedescendant={!searchable && filtered[active] ? `${listId}-${filtered[active].value}` : undefined}
            className="max-h-64 overflow-y-auto focus:outline-none"
          >
            {filtered.length === 0 ? <li className="px-3 py-4 text-center text-body-sm text-neutral-500">{emptyText}</li> : null}
            {filtered.map((o, index) => {
              const isSelected = value.includes(o.value);
              return (
                <li
                  key={o.value}
                  id={`${listId}-${o.value}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => toggle(o)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-body-sm text-neutral-800", index === active && "bg-purple-50", isSelected && !multiple && "text-purple-600")}
                >
                  {multiple ? (
                    <span aria-hidden className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2", isSelected ? "border-purple-500 bg-purple-500 text-white" : "border-neutral-300")}>
                      {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                  ) : null}
                  {o.avatar ? <Avatar name={o.avatar.name} src={o.avatar.src} size="sm" /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o.label}</span>
                    {o.description ? <span className="block truncate text-caption text-neutral-500">{o.description}</span> : null}
                  </span>
                  {!multiple && isSelected ? <Check aria-hidden className="size-4 text-purple-500" /> : null}
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
