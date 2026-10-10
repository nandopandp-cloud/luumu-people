"use client";

import { Checkbox as RadixCheckbox } from "radix-ui";
import { Archive, Check, ChevronLeft, ChevronRight, ExternalLink, Minus, MoreHorizontal, Pencil, Pin, Send, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import type { CoverIllustration, CoverTheme } from "@/design-system/illustrations/cover-art";
import { CourseCover } from "@/features/courses/course-cover";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { api, ApiError } from "@/lib/api-client";
import { MANAGED_STATUS } from "./labels";

export type ManagedRow = {
  id: string;
  title: string;
  summary: string;
  category: string;
  theme: CoverTheme;
  illustration: CoverIllustration;
  coverFileId: string | null;
  pinned: boolean;
  managedStatus: "draft" | "scheduled" | "published" | "archived";
  publishedAt: string | null;
  updatedAt: string;
  author: string | null;
};

const DOT: Record<ManagedRow["managedStatus"], string> = { published: "bg-green-500", scheduled: "bg-orange-500", draft: "bg-neutral-500", archived: "bg-neutral-300" };
const TZ = "America/Sao_Paulo";
const day = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(new Date(iso));
const time = (iso: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

function When({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-neutral-500">—</span>;
  return (
    <time dateTime={iso} className="block leading-snug">
      <span className="block text-neutral-800">{day(iso)}</span>
      <span className="text-caption text-neutral-500">{time(iso)}</span>
    </time>
  );
}

function Box({ checked, onChange, label }: { checked: boolean | "indeterminate"; onChange: (v: boolean) => void; label: string }) {
  return (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      aria-label={label}
      className="flex size-5 items-center justify-center rounded-sm border-2 border-neutral-300 bg-white data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500 data-[state=indeterminate]:border-purple-500 data-[state=indeterminate]:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
    >
      <RadixCheckbox.Indicator className="text-white">{checked === "indeterminate" ? <Minus className="size-3.5" /> : <Check className="size-3.5" />}</RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

/**
 * Tabela de comunicados da gestão: seleção para ações em lote, menu de ações
 * por linha e paginação. A interface só oferece o permitido; o servidor decide.
 */
export function ManagedTable({ rows, canPublish, total, page, pageCount, pageHref }: { rows: ManagedRow[]; canPublish: boolean; total: number; page: number; pageCount: number; pageHref: Record<number, string> }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const all = rows.length > 0 && selected.size === rows.length;
  const chosen = rows.filter((r) => selected.has(r.id));
  const archivable = canPublish ? chosen.filter((r) => r.managedStatus === "published" || r.managedStatus === "scheduled") : [];
  const deletable = chosen.filter((r) => r.managedStatus === "draft");

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function run(ids: string[], action: (id: string) => Promise<unknown>, success: (n: number) => string, confirmText?: string) {
    if (!ids.length || (confirmText && !window.confirm(confirmText))) return;
    startTransition(async () => {
      let done = 0;
      try {
        for (const id of ids) {
          await action(id);
          done += 1;
        }
        toast({ tone: "success", title: success(done) });
      } catch (e) {
        toast({ tone: "error", title: done ? `${success(done)}; os demais não foram concluídos` : "Não foi possível concluir", description: e instanceof ApiError ? e.message : "Tente novamente." });
      } finally {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const archive = (ids: string[]) =>
    run(ids, (id) => api(`/api/v1/announcements/${id}/archive`, { method: "POST" }), (n) => (n === 1 ? "Comunicado arquivado" : `${n} comunicados arquivados`), ids.length === 1 ? "Arquivar este comunicado? Ele sai do mural, mas continua no histórico." : `Arquivar ${ids.length} comunicados? Eles saem do mural, mas continuam no histórico.`);
  const remove = (ids: string[]) =>
    run(ids, (id) => api(`/api/v1/announcements/${id}`, { method: "DELETE" }), (n) => (n === 1 ? "Rascunho excluído" : `${n} rascunhos excluídos`), ids.length === 1 ? "Excluir este rascunho? Esta ação não pode ser desfeita." : `Excluir ${ids.length} rascunhos? Esta ação não pode ser desfeita.`);
  const publish = (id: string) => run([id], () => api(`/api/v1/announcements/${id}/publish`, { method: "POST", body: {} }), () => "Comunicado publicado");

  return (
    <div className={cn("card overflow-hidden p-0", pending && "opacity-80")}>
      {selected.size > 0 ? (
        <div role="region" aria-label="Ações em lote" className="flex flex-wrap items-center gap-2 border-b border-line bg-purple-50 px-5 py-2.5">
          <span className="mr-auto text-body-sm font-semibold text-purple-700">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          {archivable.length ? (
            <Button size="sm" variant="ghost" onClick={() => archive(archivable.map((r) => r.id))} disabled={pending}>
              <Archive aria-hidden /> Arquivar ({archivable.length})
            </Button>
          ) : null}
          {deletable.length ? (
            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(deletable.map((r) => r.id))} disabled={pending}>
              <Trash2 aria-hidden /> Excluir rascunhos ({deletable.length})
            </Button>
          ) : null}
          {!archivable.length && !deletable.length ? <span className="text-caption text-neutral-600">Nenhuma ação em lote para esta seleção.</span> : null}
          <Button size="sm" variant="tertiary" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-caption font-semibold uppercase tracking-wide text-neutral-600">
              <th scope="col" className="w-12 py-3 pl-5">
                <Box checked={all ? true : selected.size ? "indeterminate" : false} onChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} label="Selecionar todos os comunicados desta página" />
              </th>
              <th scope="col" className="py-3 pr-4">Comunicado</th>
              <th scope="col" className="py-3 pr-4">Categoria</th>
              <th scope="col" className="py-3 pr-4">Situação</th>
              <th scope="col" className="py-3 pr-4">Publicação</th>
              <th scope="col" className="py-3 pr-4">Atualizado</th>
              <th scope="col" className="w-20 py-3 pr-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = MANAGED_STATUS[r.managedStatus]!;
              const cat = ANNOUNCEMENT_CATEGORY[r.category];
              const href = `/gestao/comunicacao/${r.id}` as Route;
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-0 hover:bg-neutral-50", selected.has(r.id) && "bg-purple-50/60")}>
                  <td className="py-3 pl-5">
                    <Box checked={selected.has(r.id)} onChange={(v) => toggle(r.id, v)} label={`Selecionar “${r.title}”`} />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <CourseCover coverFileId={r.coverFileId} theme={r.theme} illustration={r.illustration} className="h-12 w-[76px] shrink-0 rounded-md" iconClassName="size-5" />
                      <div className="min-w-0">
                        <Link href={href} className="inline-flex items-center gap-1.5 font-semibold text-neutral-900 hover:text-purple-600 hover:underline">
                          {r.title}
                          {r.pinned ? (
                            <>
                              <Pin aria-hidden className="size-3.5 shrink-0 fill-red-500 text-red-500" />
                              <span className="sr-only">(fixado)</span>
                            </>
                          ) : null}
                        </Link>
                        <p className="line-clamp-1 max-w-[30rem] text-body-sm text-neutral-600">{r.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">{cat ? <Badge tone={cat.tone} size="md">{cat.label}</Badge> : r.category}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={status.tone} size="md" className="gap-1.5">
                      <span aria-hidden className={cn("size-2 rounded-full", DOT[r.managedStatus])} />
                      {status.label}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <When iso={r.managedStatus === "draft" ? null : r.publishedAt} />
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <When iso={r.updatedAt} />
                    {r.author ? <span className="sr-only">por {r.author}</span> : null}
                  </td>
                  <td className="py-3 pr-5 text-center">
                    <Menu>
                      <MenuTrigger asChild>
                        <button type="button" aria-label={`Ações de “${r.title}”`} className="inline-flex size-8 items-center justify-center rounded-full text-neutral-700 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
                          <MoreHorizontal aria-hidden className="size-5" />
                        </button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem asChild>
                          <Link href={href}>
                            <Pencil aria-hidden /> Editar
                          </Link>
                        </MenuItem>
                        {r.managedStatus === "published" ? (
                          <MenuItem asChild>
                            <Link href={`/comunicados/${r.id}` as Route}>
                              <ExternalLink aria-hidden /> Ver no mural
                            </Link>
                          </MenuItem>
                        ) : null}
                        {canPublish && r.managedStatus !== "published" ? (
                          <MenuItem onSelect={() => publish(r.id)}>
                            <Send aria-hidden /> Publicar agora
                          </MenuItem>
                        ) : null}
                        {canPublish && (r.managedStatus === "published" || r.managedStatus === "scheduled") ? (
                          <>
                            <MenuSeparator />
                            <MenuItem onSelect={() => archive([r.id])}>
                              <Archive aria-hidden /> Arquivar
                            </MenuItem>
                          </>
                        ) : null}
                        {r.managedStatus === "draft" ? (
                          <>
                            <MenuSeparator />
                            <MenuItem onSelect={() => remove([r.id])} className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-600">
                              <Trash2 aria-hidden /> Excluir rascunho
                            </MenuItem>
                          </>
                        ) : null}
                      </MenuContent>
                    </Menu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
        <p className="text-body-sm text-neutral-600">
          Mostrando {rows.length} de {total} {total === 1 ? "comunicado" : "comunicados"}
        </p>
        {pageCount > 1 ? (
          <nav aria-label="Páginas" className="flex items-center gap-1.5">
            <PageLink href={page > 1 ? pageHref[page - 1] : undefined} label="Página anterior">
              <ChevronLeft aria-hidden className="size-4" />
            </PageLink>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <PageLink key={p} href={pageHref[p]} current={p === page} label={`Página ${p}`}>
                {p}
              </PageLink>
            ))}
            <PageLink href={page < pageCount ? pageHref[page + 1] : undefined} label="Próxima página">
              <ChevronRight aria-hidden className="size-4" />
            </PageLink>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function PageLink({ href, current, label, children }: { href?: string; current?: boolean; label: string; children: React.ReactNode }) {
  const className = cn(
    "flex size-8 items-center justify-center rounded-md text-body-sm font-medium",
    current ? "bg-purple-500 text-white" : "border border-line bg-white text-neutral-700 hover:bg-purple-50 hover:text-purple-600",
    !href && !current && "pointer-events-none opacity-40",
  );
  if (!href || current) {
    return (
      <span aria-current={current ? "page" : undefined} aria-label={label} aria-disabled={!href && !current ? true : undefined} className={className}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href as Route} aria-label={label} scroll={false} className={cn(className, "focus-visible:outline-2 focus-visible:outline-purple-500")}>
      {children}
    </Link>
  );
}
