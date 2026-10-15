"use client";

import { Download, Eye, KeyRound, MailPlus, MoreHorizontal, Settings2, UserCheck, UserX, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Button, IconButton } from "@/design-system/components/button";
import { Checkbox } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { EmptyState } from "@/design-system/components/empty-state";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { LinkPagination, SortableTh } from "@/design-system/components/pagination";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { api, ApiError } from "@/lib/api-client";
import { directoryHref, exportQuery, PAGE_SIZES, type DirectoryParams, type DirectorySort } from "./params";

export type DirectoryItem = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  status: "invited" | "active" | "inactive";
  position: string | null;
  orgUnitId: string | null;
  orgUnit: string | null;
  managerName: string | null;
  managerImage: string | null;
  /** Já formatado no servidor ("Hoje, 09:12"); null = sem permissão ou nunca acessou. */
  lastAccess: string | null;
};

type Props = {
  items: DirectoryItem[];
  params: DirectoryParams;
  counts: { all: number; active: number; inactive: number; invited: number };
  total: number;
  page: number;
  perPage: number;
  showLastAccess: boolean;
  canExport: boolean;
  canManage: boolean;
  canAssignRoles: boolean;
  actorId: string;
  filtered: boolean;
};

const num = new Intl.NumberFormat("pt-BR");

const STATUS = {
  active: { label: "Ativo", tone: "green" },
  inactive: { label: "Inativo", tone: "neutral" },
  invited: { label: "Convite pendente", tone: "yellow" },
} as const;

/** Cor da área: estável por área (não pela posição na lista). */
const AREA_TONES = ["purple", "pink", "blue", "orange", "green", "yellow"] as const;
function areaTone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AREA_TONES[hash % AREA_TONES.length]!;
}

type Column = "position" | "orgUnit" | "manager" | "status" | "lastAccess";
const COLUMNS: { key: Column; label: string; sort: DirectorySort }[] = [
  { key: "position", label: "Cargo", sort: "cargo" },
  { key: "orgUnit", label: "Área", sort: "area" },
  { key: "manager", label: "Gestor(a)", sort: "gestor" },
  { key: "status", label: "Situação", sort: "situacao" },
  { key: "lastAccess", label: "Último acesso", sort: "acesso" },
];
const STORAGE_KEY = "luumu:colaboradores:colunas-ocultas";

/** Colunas ocultas: conveniência por navegador (localStorage pode não existir). */
const columnPrefs = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    columnPrefs.listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      columnPrefs.listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  read() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
    } catch {
      return "[]";
    }
  },
  write(hidden: Column[]) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    } catch {
      /* sem armazenamento: vale só até recarregar */
    }
    columnPrefs.listeners.forEach((l) => l());
  },
};

function parseHidden(raw: string): Set<Column> {
  try {
    const saved = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(saved) ? (saved.filter((c) => COLUMNS.some((col) => col.key === c)) as Column[]) : []);
  } catch {
    return new Set();
  }
}

const NONE = new Set<string>();

export function DirectoryTable({ items, params, counts, total, page, perPage, showLastAccess, canExport, canManage, canAssignRoles, actorId, filtered }: Props) {
  const hiddenRaw = useSyncExternalStore(columnPrefs.subscribe, columnPrefs.read, () => "[]");
  const hidden = useMemo(() => parseHidden(hiddenRaw), [hiddenRaw]);
  // A seleção vale para a página atual: some quando a lista muda.
  const pageIds = useMemo(() => items.map((i) => i.id).join(","), [items]);
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const selected = selection.key === pageIds ? selection.ids : NONE;
  const setSelected = (update: Set<string> | ((current: Set<string>) => Set<string>)) =>
    setSelection((current) => ({ key: pageIds, ids: typeof update === "function" ? update(current.key === pageIds ? current.ids : new Set()) : update }));
  const columns = COLUMNS.filter((c) => (c.key !== "lastAccess" || showLastAccess) && !hidden.has(c.key));

  const toggleColumn = (key: Column) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    columnPrefs.write([...next]);
  };

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const someSelected = items.some((i) => selected.has(i.id));
  const tab = params.status ?? "todos";
  const tabs = [
    { value: "todos", label: `Todos (${num.format(counts.all)})`, status: undefined },
    { value: "ativos", label: `Ativos (${num.format(counts.active)})`, status: "ativos" as const },
    { value: "inativos", label: `Inativos (${num.format(counts.inactive)})`, status: "inativos" as const },
    { value: "pendentes", label: `Pendentes (${num.format(counts.invited)})`, status: "pendentes" as const },
  ];

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  return (
    <section aria-labelledby="lista-colaboradores" className="card p-5 sm:p-6">
      <h2 id="lista-colaboradores" className="sr-only">
        Lista de colaboradores
      </h2>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs
          variant="soft"
          label="Filtrar por situação do acesso"
          current={tab}
          className="min-w-0 max-w-full"
          items={tabs.map((t) => ({ value: t.value, label: t.label, href: directoryHref(params, { status: t.status, pagina: undefined }) as Route }))}
        />
        <div className="flex items-center gap-2">
          {canExport ? (
            <Button asChild variant="secondary">
              <a href={exportQuery(params)} download>
                <Download aria-hidden /> Exportar
              </a>
            </Button>
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Configurar colunas">
                <Settings2 />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Colunas visíveis</MenuLabel>
              {COLUMNS.filter((c) => c.key !== "lastAccess" || showLastAccess).map((c) => (
                <MenuItem
                  key={c.key}
                  role="menuitemcheckbox"
                  aria-checked={!hidden.has(c.key)}
                  onSelect={(e) => {
                    e.preventDefault();
                    toggleColumn(c.key);
                  }}
                >
                  <span aria-hidden className={cn("flex size-4 items-center justify-center rounded border", hidden.has(c.key) ? "border-neutral-300" : "border-purple-500 bg-purple-500 text-white")}>
                    {hidden.has(c.key) ? null : "✓"}
                  </span>
                  {c.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </div>
      </div>

      {someSelected ? (
        <div role="region" aria-label="Ações em lote" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-purple-50 px-4 py-2.5">
          <p className="text-body-sm font-semibold text-purple-700" aria-live="polite">
            {selected.size} {selected.size === 1 ? "pessoa selecionada" : "pessoas selecionadas"}
          </p>
          {canExport ? (
            <Button asChild size="sm" variant="secondary">
              <a href={exportQuery(params, [...selected])} download>
                <Download aria-hidden /> Exportar seleção
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X aria-hidden /> Limpar seleção
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={filtered ? "Nenhum resultado encontrado" : "Ninguém por aqui ainda"}
          description={filtered ? "Tente ajustar os filtros ou buscar por outro termo." : "As pessoas do seu escopo aparecem aqui."}
          action={
            filtered ? (
              <Button asChild variant="secondary">
                <Link href="/gestao/colaboradores">Limpar filtros</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[60rem] border-separate border-spacing-0 text-left text-body-sm">
            <caption className="sr-only">
              Colaboradores — mostrando {from} a {to} de {total}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-10 border-b border-line py-2.5 pr-2">
                  <Checkbox
                    label={<span className="sr-only">Selecionar todos desta página</span>}
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected(v === true ? new Set(items.map((i) => i.id)) : new Set())}
                  />
                </th>
                <SortHeader label="Pessoa" sort="nome" params={params} />
                {columns.map((c) => (
                  <SortHeader key={c.key} label={c.label} sort={c.sort} params={params} />
                ))}
                <th scope="col" className="border-b border-line px-3 py-2.5 text-right text-caption font-semibold uppercase tracking-wide text-neutral-500">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((person) => (
                <tr key={person.id} className={cn("group transition-colors hover:bg-purple-50/50", selected.has(person.id) && "bg-purple-50/70")}>
                  <td className="border-b border-line py-2.5 pr-2">
                    <Checkbox
                      label={<span className="sr-only">Selecionar {person.name}</span>}
                      checked={selected.has(person.id)}
                      onCheckedChange={(v) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (v === true) next.add(person.id);
                          else next.delete(person.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="border-b border-line px-3 py-2.5">
                    <Link href={`/gestao/colaboradores/${person.id}` as Route} className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-purple-500">
                      <Avatar name={person.name} src={person.image} />
                      <span className="min-w-0">
                        <span className="block max-w-64 truncate font-semibold text-neutral-900 group-hover:text-purple-600">{person.name}</span>
                        <span className="block max-w-64 truncate text-caption text-neutral-500">{person.email}</span>
                      </span>
                    </Link>
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="border-b border-line px-3 py-2.5 text-neutral-700">
                      <Cell column={c.key} person={person} />
                    </td>
                  ))}
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    <RowActions person={person} canManage={canManage} canAssignRoles={canAssignRoles} isSelf={person.id === actorId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 ? (
        <LinkPagination
          page={page}
          perPage={perPage}
          total={total}
          pageSizes={PAGE_SIZES}
          hrefForPage={(p) => directoryHref(params, { pagina: p })}
          hrefForSize={(n) => directoryHref(params, { por: n as DirectoryParams["por"], pagina: undefined })}
        />
      ) : null}
    </section>
  );
}

function Cell({ column, person }: { column: Column; person: DirectoryItem }) {
  switch (column) {
    case "position":
      return <>{person.position ?? "—"}</>;
    case "orgUnit":
      return person.orgUnit && person.orgUnitId ? (
        <Badge tone={areaTone(person.orgUnitId)} className="max-w-48 truncate">
          {person.orgUnit}
        </Badge>
      ) : (
        <>—</>
      );
    case "manager":
      return person.managerName ? (
        <span className="inline-flex items-center gap-2">
          <Avatar name={person.managerName} src={person.managerImage} size="sm" />
          <span className="max-w-44 truncate text-neutral-800">{person.managerName}</span>
        </span>
      ) : (
        <span aria-label="Sem gestor(a)">—</span>
      );
    case "status":
      return <Badge tone={STATUS[person.status].tone}>{STATUS[person.status].label}</Badge>;
    case "lastAccess":
      return <span className="whitespace-nowrap tabular-nums">{person.lastAccess ?? (person.status === "invited" ? "Ainda não acessou" : "—")}</span>;
  }
}

function RowActions({ person, canManage, canAssignRoles, isSelf }: { person: DirectoryItem; canManage: boolean; canAssignRoles: boolean; isSelf: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const first = person.name.split(" ")[0];

  const run = (fn: () => Promise<unknown>, success: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast({ tone: "success", title: success });
        router.refresh();
      } catch (error) {
        toast({ tone: "error", title: error instanceof ApiError ? error.message : "Não foi possível concluir a ação." });
      }
    });

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <IconButton label={`Ações de ${person.name}`} variant="plain" size="sm" disabled={pending} className="text-neutral-600">
            <MoreHorizontal />
          </IconButton>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem asChild>
            <Link href={`/gestao/colaboradores/${person.id}` as Route}>
              <Eye aria-hidden /> Ver perfil
            </Link>
          </MenuItem>
          {canAssignRoles ? (
            <MenuItem asChild>
              <Link href={`/gestao/colaboradores/${person.id}#papeis` as Route}>
                <KeyRound aria-hidden /> Gerenciar papéis
              </Link>
            </MenuItem>
          ) : null}
          {canManage && !isSelf ? (
            <>
              <MenuSeparator />
              {person.status === "invited" ? (
                <MenuItem onSelect={() => run(() => api(`/api/v1/people/${person.id}/invite`, { method: "POST" }), `Convite reenviado para ${first}.`)}>
                  <MailPlus aria-hidden /> Reenviar convite
                </MenuItem>
              ) : null}
              {person.status === "inactive" ? (
                <MenuItem onSelect={() => run(() => api(`/api/v1/people/${person.id}/status`, { method: "POST", body: { status: "active" } }), `Acesso de ${first} reativado.`)}>
                  <UserCheck aria-hidden /> Reativar acesso
                </MenuItem>
              ) : (
                <MenuItem onSelect={() => setConfirm(true)} className="text-red-700 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700">
                  <UserX aria-hidden /> {person.status === "invited" ? "Cancelar convite" : "Desativar acesso"}
                </MenuItem>
              )}
            </>
          ) : null}
        </MenuContent>
      </Menu>
      {confirm ? (
        <Modal
          open
          onOpenChange={(v) => !v && setConfirm(false)}
          title={person.status === "invited" ? `Cancelar o convite de ${first}?` : `Desativar o acesso de ${first}?`}
          description={
            person.status === "invited"
              ? "O link enviado deixa de funcionar e a pessoa vai para Inativos. Você pode reativar depois."
              : "A pessoa sai da plataforma na hora e não consegue mais entrar. O histórico é mantido e você pode reativar depois."
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                loading={pending}
                onClick={() => {
                  setConfirm(false);
                  run(() => api(`/api/v1/people/${person.id}/status`, { method: "POST", body: { status: "inactive" } }), person.status === "invited" ? "Convite cancelado." : `Acesso de ${first} desativado.`);
                }}
              >
                {person.status === "invited" ? "Cancelar convite" : "Desativar acesso"}
              </Button>
            </>
          }
        />
      ) : null}
    </>
  );
}

function SortHeader({ label, sort, params }: { label: string; sort: DirectorySort; params: DirectoryParams }) {
  const active = (params.ordem ?? "nome") === sort;
  const dir = params.dir ?? "asc";
  return <SortableTh label={label} active={active} dir={dir} href={directoryHref(params, { ordem: sort, dir: active && dir === "asc" ? "desc" : "asc", pagina: undefined })} />;
}
