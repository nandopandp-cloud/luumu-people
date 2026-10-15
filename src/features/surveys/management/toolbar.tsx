"use client";

import { Filter, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { DatePicker } from "@/design-system/components/date-picker";
import { Drawer } from "@/design-system/components/dialog";
import { Field, Input } from "@/design-system/components/field";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { Select } from "@/design-system/components/select";
import { surveysHref, type SurveyParams } from "@/lib/survey-params";
import { SURVEY_KIND } from "../labels";

const num = new Intl.NumberFormat("pt-BR");

export type SurveyCounts = { all: number; ativas: number; agendadas: number; encerradas: number; rascunhos: number };

/** Abas por situação + busca e filtros (tudo na URL). */
export function SurveyToolbar({ params, counts, areas, showDrafts }: { params: SurveyParams; counts: SurveyCounts; areas: { id: string; name: string }[]; showDrafts: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.q ?? "");
  const [moreOpen, setMoreOpen] = useState(false);
  const typed = useRef(false);
  const go = (patch: Partial<SurveyParams>) => startTransition(() => router.replace(surveysHref(params, { ...patch, pagina: undefined }) as Route, { scroll: false }));

  useEffect(() => {
    if (!typed.current) return;
    const timer = window.setTimeout(() => go({ q: search.trim() || undefined }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao texto digitado
  }, [search]);

  const tabs = [
    { value: "todas", label: `Todas (${num.format(counts.all)})`, status: undefined },
    { value: "ativas", label: `Ativas (${num.format(counts.ativas)})`, status: "ativas" as const },
    { value: "agendadas", label: `Agendadas (${num.format(counts.agendadas)})`, status: "agendadas" as const },
    { value: "encerradas", label: `Encerradas (${num.format(counts.encerradas)})`, status: "encerradas" as const },
    ...(showDrafts ? [{ value: "rascunhos", label: `Rascunhos (${num.format(counts.rascunhos)})`, status: "rascunhos" as const }] : []),
  ];
  const extra = [params.de, params.ate].filter(Boolean).length;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <LinkTabs
        variant="soft"
        size="sm"
        label="Filtrar por situação"
        current={params.status ?? "todas"}
        className="min-w-0 max-w-full"
        items={tabs.map((t) => ({ value: t.value, label: t.label, href: surveysHref(params, { status: t.status, pagina: undefined }) as Route }))}
      />
      <form role="search" aria-label="Filtrar pesquisas" aria-busy={pending} className="flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()}>
        <div className="w-full sm:w-64">
          <label className="sr-only" htmlFor="busca-pesquisas">
            Buscar por nome da pesquisa
          </label>
          <Input
            id="busca-pesquisas"
            type="search"
            className="h-10"
            value={search}
            onChange={(e) => {
              typed.current = true;
              setSearch(e.target.value);
            }}
            placeholder="Buscar por nome da pesquisa…"
            leading={<Search />}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-44">
          <Select aria-label="Tipo" className="h-10" value={params.tipo ?? ""} onChange={(e) => go({ tipo: (e.target.value || undefined) as SurveyParams["tipo"] })}>
            <option value="">Todos os tipos</option>
            {Object.entries(SURVEY_KIND).map(([value, kind]) => (
              <option key={value} value={value}>
                {kind.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-48">
          <Select aria-label="Público" className="h-10" value={params.area ?? ""} onChange={(e) => go({ area: e.target.value || undefined })}>
            <option value="">Todas as áreas</option>
            <option value="empresa">Toda a empresa</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" className="h-10" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
          <Filter aria-hidden /> Mais filtros
          {extra ? (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-purple-500 text-[11px] text-white">
              {extra}
              <span className="sr-only"> {extra === 1 ? "filtro ativo" : "filtros ativos"}</span>
            </span>
          ) : null}
        </Button>
      </form>
      {moreOpen ? <MoreFilters params={params} onClose={() => setMoreOpen(false)} onApply={go} /> : null}
    </div>
  );
}

function MoreFilters({ params, onClose, onApply }: { params: SurveyParams; onClose: () => void; onApply: (patch: Partial<SurveyParams>) => void }) {
  const [from, setFrom] = useState<string | null>(params.de ?? null);
  const [to, setTo] = useState<string | null>(params.ate ?? null);
  const invalid = Boolean(from && to && from > to);
  const apply = (patch: Partial<SurveyParams>) => {
    onApply(patch);
    onClose();
  };
  return (
    <Drawer
      open
      onOpenChange={(v) => !v && onClose()}
      title="Mais filtros"
      description="Pesquisas com início dentro do período."
      footer={
        <>
          <Button variant="ghost" onClick={() => apply({ de: undefined, ate: undefined })}>
            Limpar
          </Button>
          <Button disabled={invalid} onClick={() => apply({ de: from ?? undefined, ate: to ?? undefined })}>
            Aplicar filtros
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Início a partir de">{({ id }) => <DatePicker id={id} value={from} onChange={setFrom} />}</Field>
        <Field label="Início até" error={invalid ? "A data final precisa ser depois da inicial." : null}>
          {({ id, invalid: bad }) => <DatePicker id={id} value={to} onChange={setTo} invalid={bad} />}
        </Field>
      </div>
    </Drawer>
  );
}
