"use client";

import { BookOpen, ClipboardList, Eye, FilterX, MoreHorizontal, MoreVertical, Plus, Search, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/design-system/components/button";
import { Drawer } from "@/design-system/components/dialog";
import { Input } from "@/design-system/components/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { Select } from "@/design-system/components/select";
import { cn } from "@/design-system/cn";
import type { CompetencySuggestions } from "@/server/modules/development/suggestions";
import type { CompetencyRow } from "@/server/modules/development/service";
import { NewCompetencyButton } from "./competency-form";
import { AssessCompetencyButton } from "./forms";
import { CATEGORY_LABEL, levelName, LEVEL, SOURCE_LABEL } from "./labels";
import { CompetencyIcon } from "./side-cards";
import { suggestionHref, SuggestionIcon } from "./suggestion-bits";

type Status = CompetencyRow["level"];
type Filter = "all" | Status;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "developing", label: "Em desenvolvimento" },
  { value: "developed", label: "No nível esperado" },
  { value: "to_develop", label: "Para evoluir" },
];

const levelOf = (score: number | null) => (score === null ? 0 : Math.max(0, Math.min(5, Math.floor(score / 20))));
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });

type GoalLink = { id: string; title: string; competencyId: string | null; progress: number };

type Props = {
  competencies: CompetencyRow[];
  goals: GoalLink[];
  suggestions: CompetencySuggestions[];
  isSelf: boolean;
  canAssess: boolean;
  canManageCatalog: boolean;
  /** Pessoa avaliada (visão da liderança). */
  assessUserId?: string;
  pdiHref: Route;
  evolutionHref: Route;
  recommendationsHref?: Route;
};

/** "Minhas competências": situação frente ao esperado, filtros, busca, área e detalhes. */
export function CompetencyList({ competencies, goals, suggestions, isSelf, canAssess, canManageCatalog, assessUserId, pdiHref, evolutionHref, recommendationsHref }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = competencies.find((c) => c.id === openId) ?? null;

  const scoped = useMemo(() => {
    const term = normalize(search.trim());
    return competencies.filter((c) => (!area || c.category === area) && (!term || normalize(`${c.name} ${c.description ?? ""}`).includes(term)));
  }, [competencies, search, area]);
  const countOf = (f: Filter) => (f === "all" ? scoped.length : scoped.filter((c) => c.level === f).length);
  const visible = filter === "all" ? scoped : scoped.filter((c) => c.level === filter);
  const areas = [...new Set(competencies.map((c) => c.category))];
  const filtered = filter !== "all" || search || area;
  const clear = () => {
    setFilter("all");
    setSearch("");
    setArea("");
  };

  return (
    <section aria-labelledby="competencias-titulo" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="competencias-titulo" className="text-h2 font-bold tracking-[-0.01em] text-neutral-900">
            {isSelf ? "Minhas competências" : "Competências"}
          </h2>
          <p className="mt-0.5 text-body-sm text-neutral-600">Acompanhe o nível atual, a meta definida para o cargo e as sugestões de desenvolvimento.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageCatalog ? (
            <NewCompetencyButton
              trigger={
                <Button>
                  <Plus aria-hidden /> Adicionar competência
                </Button>
              }
            />
          ) : null}
          <Menu>
            <MenuTrigger asChild>
              <IconButton label="Mais opções das competências">
                <MoreHorizontal />
              </IconButton>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem asChild>
                <Link href={evolutionHref}>
                  <TrendingUp aria-hidden /> Ver evolução
                </Link>
              </MenuItem>
              {recommendationsHref ? (
                <MenuItem asChild>
                  <Link href={recommendationsHref}>
                    <BookOpen aria-hidden /> Ver recomendações
                  </Link>
                </MenuItem>
              ) : null}
              <MenuItem asChild>
                <Link href={pdiHref}>
                  <ClipboardList aria-hidden /> {isSelf ? "Abrir meu PDI" : "Abrir o PDI"}
                </Link>
              </MenuItem>
              {filtered ? (
                <>
                  <MenuSeparator />
                  <MenuItem onSelect={clear}>
                    <FilterX aria-hidden /> Limpar filtros
                  </MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
        </div>
      </div>

      <div className="@container rounded-xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "relative inline-flex h-9 items-center gap-2 rounded-lg px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                    active ? "bg-purple-50 text-purple-700" : "bg-neutral-100/70 text-neutral-700 hover:bg-purple-50 hover:text-purple-700",
                  )}
                >
                  {f.label}
                  <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-purple-500 text-white" : "bg-white text-neutral-700")}>{countOf(f.value)}</span>
                  {active ? <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-purple-500" /> : null}
                </button>
              );
            })}
          </div>
          <div className="flex w-full gap-2 @[54rem]:ml-auto @[54rem]:w-auto">
            <div className="min-w-0 flex-1 @[54rem]:w-52 @[54rem]:flex-none">
              <Input type="search" aria-label="Buscar competência" placeholder="Buscar competência…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} className="h-9" />
            </div>
            <div className="w-40 shrink-0">
              <Select aria-label="Área" value={area} onChange={(e) => setArea(e.target.value)} className="h-9">
                <option value="">Área: Todas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {CATEGORY_LABEL[a] ?? a}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-body-sm text-neutral-600">Nenhuma competência encontrada.</p>
            {filtered ? (
              <Button variant="tertiary" size="sm" className="mt-2" onClick={clear}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <ul aria-label="Competências" className="divide-y divide-line">
            {visible.map((c) => {
              const level = levelOf(c.score);
              const status = LEVEL[c.level];
              const goal = goals.find((g) => g.competencyId === c.id);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <CompetencyIcon icon={c.icon} className="size-12" />
                  <div className="grid min-w-0 flex-1 gap-2 @[44rem]:grid-cols-[minmax(0,1fr)_7.5rem_10.5rem] @[44rem]:items-center @[44rem]:gap-4">
                    <div className="min-w-0">
                      <h3 className="text-body-sm font-bold text-neutral-900">{c.name}</h3>
                      {c.description ? <p className="line-clamp-2 text-caption text-neutral-600">{c.description}</p> : null}
                    </div>
                    <p>
                      <span className="text-caption text-neutral-600">Nível atual </span>
                      <span className="text-body-sm font-semibold text-neutral-900 @[44rem]:block">{level ? levelName(level) : "Sem avaliação"}</span>
                    </p>
                    <div>
                      <div className="flex items-center gap-2">
                        <div role="progressbar" aria-label={`${c.name}: nível atual`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.score ?? 0} className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${c.score ?? 0}%` }} />
                        </div>
                        <span className="w-9 text-right text-caption tabular-nums text-neutral-700">{c.score === null ? "—" : `${c.score}%`}</span>
                      </div>
                      <span className={cn("mt-1.5 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.chip)}>{status.label}</span>
                    </div>
                  </div>
                  <Button variant="soft" size="sm" onClick={() => setOpenId(c.id)} className="hidden shrink-0 @[30rem]:inline-flex">
                    Ver detalhes<span className="sr-only"> de {c.name}</span>
                  </Button>
                  <Menu>
                    <MenuTrigger asChild>
                      <IconButton label={`Opções de ${c.name}`} variant="plain" size="sm" className="shrink-0 text-neutral-600">
                        <MoreVertical />
                      </IconButton>
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem onSelect={() => setOpenId(c.id)}>
                        <Eye aria-hidden /> Ver detalhes
                      </MenuItem>
                      {goal ? (
                        <MenuItem asChild>
                          <Link href={pdiHref}>
                            <ClipboardList aria-hidden /> Ver no PDI
                          </Link>
                        </MenuItem>
                      ) : null}
                      <MenuItem asChild>
                        <Link href={evolutionHref}>
                          <TrendingUp aria-hidden /> Ver evolução
                        </Link>
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {open ? (
        <CompetencyDetails
          competency={open}
          goals={goals.filter((g) => g.competencyId === open.id)}
          suggestions={suggestions.find((s) => s.competencyId === open.id)?.items ?? []}
          canAssess={canAssess}
          assessUserId={assessUserId}
          pdiHref={pdiHref}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </section>
  );
}

function CompetencyDetails({
  competency: c,
  goals,
  suggestions,
  canAssess,
  assessUserId,
  pdiHref,
  onClose,
}: {
  competency: CompetencyRow;
  goals: GoalLink[];
  suggestions: CompetencySuggestions["items"];
  canAssess: boolean;
  assessUserId?: string;
  pdiHref: Route;
  onClose: () => void;
}) {
  const level = levelOf(c.score);
  const next = level < 5 ? (level + 1) * 20 : null;
  const status = LEVEL[c.level];
  const history = [...c.history].reverse();
  return (
    <Drawer
      open
      onOpenChange={(v) => !v && onClose()}
      title={c.name}
      description={CATEGORY_LABEL[c.category] ?? c.category}
      footer={
        <>
          {canAssess ? <AssessCompetencyButton userId={assessUserId} competencyId={c.id} competencyName={c.name} current={c.score} label="Avaliar" /> : null}
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <CompetencyIcon icon={c.icon} className="size-12" />
          <div className="min-w-0">
            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-caption font-semibold", status.chip)}>{status.label}</span>
            {c.description ? <p className="mt-2 text-body-sm text-neutral-700">{c.description}</p> : null}
          </div>
        </div>

        <section aria-labelledby="detalhe-nivel">
          <h3 id="detalhe-nivel" className="text-body-sm font-bold text-neutral-900">
            Atual x esperado para o cargo
          </h3>
          <div
            className="relative mt-3 h-2.5 rounded-full bg-neutral-100"
            role="img"
            aria-label={`${c.name}: atual ${c.score ?? "sem avaliação"}${c.score !== null ? "%" : ""}, esperado ${c.expected}%`}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${c.score ?? 0}%` }} />
            <span aria-hidden className="absolute -top-1 h-[18px] w-0.5 rounded bg-neutral-800" style={{ left: `calc(${c.expected}% - 1px)` }} />
          </div>
          <p className="mt-2 flex justify-between text-caption text-neutral-600">
            <span>
              Atual: <strong className="text-neutral-900">{c.score === null ? "—" : `${c.score}%`}</strong>
            </span>
            <span>
              Esperado: <strong className="text-neutral-900">{c.expected}%</strong>
            </span>
          </p>
          <p className="mt-3 rounded-lg bg-purple-50 px-3 py-2 text-body-sm text-purple-700">
            {level ? `Nível ${level} · ${levelName(level)}. ` : "Ainda sem avaliação. "}
            {next === null ? "Nível máximo alcançado 🎉" : c.score === null ? "" : `Faltam ${next - c.score} pontos para o nível ${level + 1}.`}
          </p>
        </section>

        <section aria-labelledby="detalhe-historico">
          <h3 id="detalhe-historico" className="text-body-sm font-bold text-neutral-900">
            Histórico de avaliações
          </h3>
          {history.length === 0 ? (
            <p className="mt-2 text-body-sm text-neutral-600">Nenhuma avaliação registrada.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line rounded-lg border border-line">
              {history.map((h, i) => {
                const before = history[i + 1];
                const diff = before ? h.score - before.score : null;
                return (
                  <li key={`${new Date(h.assessedAt).toISOString()}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-body-sm">
                    <span className="min-w-0">
                      <span className="block font-medium text-neutral-900">{SOURCE_LABEL[h.source] ?? h.source}</span>
                      <time dateTime={new Date(h.assessedAt).toISOString()} className="text-caption text-neutral-600">
                        {dateFmt.format(new Date(h.assessedAt))}
                      </time>
                    </span>
                    <span className="flex items-center gap-2">
                      {diff ? <span className={cn("text-caption font-semibold", diff > 0 ? "text-green-700" : "text-red-700")}>{diff > 0 ? `+${diff}` : diff}</span> : null}
                      <span className="font-semibold tabular-nums text-neutral-900">{h.score}%</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {goals.length ? (
          <section aria-labelledby="detalhe-pdi">
            <h3 id="detalhe-pdi" className="text-body-sm font-bold text-neutral-900">
              No PDI
            </h3>
            <ul className="mt-2 space-y-2">
              {goals.map((g) => (
                <li key={g.id}>
                  <Link href={pdiHref} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                    <ClipboardList aria-hidden className="size-5 shrink-0 text-purple-600" />
                    <span className="min-w-0 flex-1 text-body-sm font-medium text-neutral-900">{g.title}</span>
                    <span className="text-caption font-semibold tabular-nums text-neutral-700">{g.progress}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {suggestions.length ? (
          <section aria-labelledby="detalhe-sugestoes">
            <h3 id="detalhe-sugestoes" className="text-body-sm font-bold text-neutral-900">
              Para desenvolver
            </h3>
            <ul className="mt-2 space-y-2">
              {suggestions.map((s) => (
                <li key={`${s.kind}-${s.id}`}>
                  <Link href={suggestionHref(s)} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                    <SuggestionIcon kind={s.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-sm font-semibold text-neutral-900">
                        {s.kind === "path" ? "Trilha" : "Curso"}: {s.title}
                      </span>
                      <span className="block text-caption text-neutral-600">{s.status === "in_progress" ? "Você já começou" : `${Math.round(s.minutes / 60) || 1} h de conteúdo`}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
