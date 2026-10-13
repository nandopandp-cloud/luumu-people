"use client";

import { useId, useRef, useState } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Textarea } from "@/design-system/components/field";
import { cn } from "@/design-system/cn";
import { api } from "@/lib/api-client";

type Person = { id: string; name: string; image: string | null };

/** "@" + o que foi digitado até o cursor (nomes podem ter espaço); "@" sozinho lista todo mundo. */
const QUERY = /(?:^|\s)@((?:[\p{L}][\p{L}\p{M}'. -]{0,39})?)$/u;

/**
 * Campo de comentário com sugestões de menção. Ao digitar "@", lista todas as
 * pessoas que veem o comunicado (digitar parte do nome filtra); escolher insere "@Nome" e guarda o id em
 * `mentions` (nome exibido → id). Quem envia converte com `encodeMentions`.
 */
export function MentionTextarea({
  announcementId,
  value,
  onChange,
  mentions,
  onMentionsChange,
  id,
  describedBy,
  invalid,
  disabled,
  rows = 3,
  placeholder,
  autoFocus,
}: {
  announcementId: string;
  value: string;
  onChange: (value: string) => void;
  mentions: Map<string, string>;
  onMentionsChange: (mentions: Map<string, string>) => void;
  id: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const request = useRef(0);
  const [query, setQuery] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const open = query !== null && people.length > 0;

  function close() {
    setQuery(null);
    setPeople([]);
    window.clearTimeout(timer.current);
  }

  /** Procura a menção em andamento antes do cursor e busca sugestões (com espera curta). */
  function lookup(text: string, caret: number) {
    const match = QUERY.exec(text.slice(0, caret));
    if (!match) return close();
    const q = match[1]!.trimEnd();
    setQuery(q);
    window.clearTimeout(timer.current);
    const ticket = ++request.current;
    timer.current = window.setTimeout(async () => {
      try {
        const { items } = await api<{ items: Person[] }>(`/api/v1/announcements/${announcementId}/mentionable?q=${encodeURIComponent(q)}`);
        if (ticket !== request.current) return;
        setPeople(items);
        setActive(0);
      } catch {
        if (ticket === request.current) setPeople([]);
      }
    }, q ? 200 : 0);
  }

  function choose(person: Person) {
    const el = area.current;
    if (!el || query === null) return;
    const caret = el.selectionStart;
    const start = value.slice(0, caret).lastIndexOf(`@${query}`);
    if (start < 0) return close();
    const name = person.name.replace(/[[\]()\n]/g, "");
    const inserted = `@${name} `;
    const next = value.slice(0, start) + inserted + value.slice(start + 1 + query.length);
    onChange(next);
    onMentionsChange(new Map(mentions).set(name, person.id));
    close();
    requestAnimationFrame(() => {
      el.focus();
      const at = start + inserted.length;
      el.setSelectionRange(at, at);
    });
  }

  return (
    <div className="relative">
      <Textarea
        ref={area}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        invalid={invalid}
        value={value}
        maxLength={1000}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          lookup(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const next = (active + (e.key === "ArrowDown" ? 1 : -1) + people.length) % people.length;
            setActive(next);
            // A lista pode ter a empresa toda: mantém a opção ativa à vista.
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            choose(people[active]!);
          } else if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
        }}
        onBlur={() => window.setTimeout(close, 150)}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Pessoas para mencionar"
        className={cn("absolute left-0 top-full z-20 mt-1 max-h-64 w-full max-w-sm overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-lg", !open && "hidden")}
      >
        {people.map((p, i) => (
          <li
            key={p.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              choose(p);
            }}
            onMouseEnter={() => setActive(i)}
            className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-body-sm text-neutral-800", i === active && "bg-purple-50 text-purple-700")}
          >
            <Avatar name={p.name} src={p.image} size="sm" />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
