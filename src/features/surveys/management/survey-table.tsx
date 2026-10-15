"use client";

import { ClipboardList, Download, Gauge, HeartPulse, Sparkles, X, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Checkbox } from "@/design-system/components/choice";
import { EmptyState } from "@/design-system/components/empty-state";
import { LinkPagination, SortableTh } from "@/design-system/components/pagination";
import { cn } from "@/design-system/cn";
import { SURVEY_PAGE_SIZES, surveysExportHref, surveysHref, type SurveyParams } from "@/lib/survey-params";
import { formatDay, SURVEY_KIND, SURVEY_STATUS } from "../labels";
import { SurveyActions } from "../survey-actions";

export type SurveyItem = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  status: "draft" | "active" | "paused" | "closed";
  displayStatus: keyof typeof SURVEY_STATUS;
  opensAt: string | null;
  closesAt: string | null;
  audienceName: string | null;
  audienceSize: number;
  invited: number;
  completed: number;
  rate: number | null;
};

const num = new Intl.NumberFormat("pt-BR");

/** Ícone e cores por tipo (bloco arredondado, como na referência). */
const KIND_ICON: Record<string, { icon: LucideIcon; tile: string }> = {
  climate: { icon: ClipboardList, tile: "bg-purple-50 text-purple-600" },
  enps: { icon: Gauge, tile: "bg-blue-50 text-blue-700" },
  pulse: { icon: HeartPulse, tile: "bg-orange-50 text-orange-600" },
  custom: { icon: Sparkles, tile: "bg-green-50 text-green-700" },
};

type Props = {
  items: SurveyItem[];
  params: SurveyParams;
  total: number;
  page: number;
  perPage: number;
  canDesign: boolean;
  canLaunch: boolean;
  canExport: boolean;
  filtered: boolean;
};

const NONE = new Set<string>();

export function SurveyTable({ items, params, total, page, perPage, canDesign, canLaunch, canExport, filtered }: Props) {
  // A seleção vale para a página atual: some quando a lista muda.
  const pageIds = useMemo(() => items.map((i) => i.id).join(","), [items]);
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const selected = selection.key === pageIds ? selection.ids : NONE;
  const setSelected = (ids: Set<string>) => setSelection({ key: pageIds, ids });
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const someSelected = items.some((i) => selected.has(i.id));
  const sortHref = (sort: NonNullable<SurveyParams["ordem"]>) => {
    const active = params.ordem === sort;
    return surveysHref(params, { ordem: sort, dir: active && (params.dir ?? "asc") === "asc" ? "desc" : "asc", pagina: undefined });
  };
  const header = (label: string, sort: NonNullable<SurveyParams["ordem"]>) => <SortableTh label={label} active={params.ordem === sort} dir={params.dir ?? "asc"} href={sortHref(sort)} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title={filtered ? "Nenhuma pesquisa encontrada" : "Nenhuma pesquisa criada"}
        description={filtered ? "Tente ajustar os filtros ou buscar por outro nome." : "Comece por um modelo de clima, eNPS ou pulso e ajuste as perguntas."}
        action={
          filtered ? (
            <Button asChild variant="secondary">
              <Link href="/gestao/pesquisas">Limpar filtros</Link>
            </Button>
          ) : canDesign ? (
            <Button asChild variant="soft">
              <Link href="/gestao/pesquisas/nova">Nova pesquisa</Link>
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <>
      {someSelected ? (
        <div role="region" aria-label="Ações em lote" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-purple-50 px-4 py-2.5">
          <p className="text-body-sm font-semibold text-purple-700" aria-live="polite">
            {selected.size} {selected.size === 1 ? "pesquisa selecionada" : "pesquisas selecionadas"}
          </p>
          {canExport ? (
            <Button asChild size="sm" variant="secondary">
              <a href={surveysExportHref(params, [...selected])} download>
                <Download aria-hidden /> Exportar participação
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            <X aria-hidden /> Limpar seleção
          </Button>
        </div>
      ) : null}

      <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
        <table className="w-full min-w-[64rem] border-separate border-spacing-0 text-left text-body-sm">
          <caption className="sr-only">Pesquisas</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10 border-b border-line py-2.5 pr-2">
                <Checkbox
                  label={<span className="sr-only">Selecionar todas desta página</span>}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(items.map((i) => i.id)) : new Set())}
                />
              </th>
              {header("Pesquisa", "pesquisa")}
              {header("Tipo", "tipo")}
              {header("Público", "publico")}
              {header("Período", "periodo")}
              {header("Participação", "participacao")}
              {header("Status", "status")}
              <th scope="col" className="border-b border-line px-3 py-2.5 text-right text-caption font-semibold uppercase tracking-wide text-neutral-500">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const kind = SURVEY_KIND[s.kind] ?? SURVEY_KIND.custom!;
              const visual = KIND_ICON[s.kind] ?? KIND_ICON.custom!;
              const status = SURVEY_STATUS[s.displayStatus];
              const rate = s.rate ?? 0;
              return (
                <tr key={s.id} className={cn("group transition-colors hover:bg-purple-50/50", selected.has(s.id) && "bg-purple-50/70")}>
                  <td className="border-b border-line py-3 pr-2">
                    <Checkbox label={<span className="sr-only">Selecionar {s.title}</span>} checked={selected.has(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} />
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Link href={`/gestao/pesquisas/${s.id}` as Route} className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-purple-500">
                      <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", visual.tile)}>
                        <visual.icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-64 truncate font-semibold text-neutral-900 group-hover:text-purple-600">{s.title}</span>
                        {s.description ? <span className="block max-w-64 truncate text-caption text-neutral-500">{s.description}</span> : null}
                      </span>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                  </td>
                  <td className="border-b border-line px-3 py-3 text-neutral-700">
                    <span className="block">{s.audienceName ?? "Toda a empresa"}</span>
                    <span className="block text-caption text-neutral-500">
                      ({num.format(s.audienceSize)} {s.audienceSize === 1 ? "pessoa" : "pessoas"})
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-3 whitespace-nowrap text-neutral-700 tabular-nums">
                    {s.opensAt && s.closesAt ? (
                      <>
                        <span className="block">{formatDay(s.opensAt)}</span>
                        <span className="block text-caption text-neutral-500">até {formatDay(s.closesAt)}</span>
                      </>
                    ) : (
                      <span aria-label="Sem período definido">—</span>
                    )}
                  </td>
                  <td className="w-52 border-b border-line px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div role="progressbar" aria-label={`Participação em ${s.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate} className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="w-9 text-right text-caption tabular-nums text-neutral-700">{rate}%</span>
                    </div>
                    <span className="mt-1 block text-caption tabular-nums text-neutral-500">
                      {num.format(s.completed)} de {num.format(s.status === "draft" ? s.audienceSize : s.invited)}
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="border-b border-line px-3 py-3 text-right">
                    <SurveyActions
                      survey={{ id: s.id, title: s.title, description: s.description, status: s.status, closesAt: s.closesAt, scheduled: s.displayStatus === "scheduled" }}
                      canDesign={canDesign}
                      canLaunch={canLaunch}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <LinkPagination
        page={page}
        perPage={perPage}
        total={total}
        pageSizes={SURVEY_PAGE_SIZES}
        noun={["pesquisa", "pesquisas"]}
        hrefForPage={(p) => surveysHref(params, { pagina: p })}
        hrefForSize={(n) => surveysHref(params, { por: n as SurveyParams["por"], pagina: undefined })}
      />
    </>
  );
}
