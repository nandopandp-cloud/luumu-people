import { ArrowUpRight, BarChart3, ChevronRight, Layers, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { EmptyState } from "@/design-system/components/empty-state";
import { cn } from "@/design-system/cn";
import type { CompetencySuggestions } from "@/server/modules/development/suggestions";
import type { Development } from "@/server/modules/development/service";
import { suggestionHref, SuggestionIcon } from "./suggestion-bits";
import { CompetencyIcon, SideCard } from "./side-cards";

function Stat({ tone, icon, value, label }: { tone: "white" | "blue" | "green" | "orange"; icon: ReactNode; value: number; label: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-3.5", { white: "bg-white", blue: "bg-blue-50", green: "bg-green-50", orange: "bg-orange-50" }[tone])}>
      <span
        aria-hidden
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", {
          white: "bg-purple-100 text-purple-600",
          blue: "bg-white text-blue-500",
          green: "bg-green-100 text-green-700",
          orange: "bg-orange-100 text-orange-600",
        }[tone])}
      >
        {icon}
      </span>
      <p className="min-w-0">
        <span className="block text-h2 font-bold tabular-nums text-neutral-900">{value}</span>
        <span className="block text-caption leading-snug text-neutral-700">{label}</span>
      </p>
    </div>
  );
}

/** Topo da aba: total, em desenvolvimento, no nível esperado e para evoluir. */
export function CompetencyStats({ development }: { development: Development }) {
  const { competencies, counts } = development;
  return (
    <section aria-label="Resumo das competências" className="@container rounded-xl border border-line bg-white p-2 shadow-sm">
      <div className="grid gap-2 @[28rem]:grid-cols-2 @[44rem]:grid-cols-4">
        <Stat tone="white" icon={<Layers className="size-6" />} value={competencies.length} label="Competências no total" />
        <Stat tone="blue" icon={<LoaderCircle className="size-6" />} value={counts.developing} label="Em desenvolvimento" />
        <Stat tone="green" icon={<BarChart3 className="size-6" />} value={counts.developed} label="No nível esperado" />
        <Stat tone="orange" icon={<ArrowUpRight className="size-6" />} value={counts.toDevelop} label="Para evoluir" />
      </div>
    </section>
  );
}

const describe = (item: CompetencySuggestions["items"][number]) => item.description ?? (item.kind === "path" ? "Trilha do catálogo da empresa." : "Curso do catálogo da empresa.");

/** Uma sugestão por competência a desenvolver (as de maior distância do esperado primeiro). */
export function SuggestionsCard({ suggestions, href }: { suggestions: CompetencySuggestions[]; href: Route }) {
  const picks = suggestions.map((s) => s.items[0]!).slice(0, 2);
  return (
    <SideCard id="sugestoes" title="Sugestões para você" href={href}>
      {picks.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Quando houver conteúdo para as competências que você está desenvolvendo, ele aparece aqui.</p>
      ) : (
        <ul className="space-y-3">
          {picks.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <Link href={suggestionHref(item)} className="group flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-purple-200 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                <SuggestionIcon kind={item.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm font-semibold text-neutral-900">
                    {item.kind === "path" ? "Trilha" : "Curso"}: {item.title}
                  </span>
                  <span className="line-clamp-2 text-caption text-neutral-600">{describe(item)}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  );
}

/** Aba Recomendações: conteúdo do catálogo para cada competência abaixo do esperado. */
export function RecommendationsPanel({ suggestions, development, learningEnabled }: { suggestions: CompetencySuggestions[]; development: Development; learningEnabled: boolean }) {
  const pending = development.competencies.filter((c) => c.level !== "developed").length;
  if (!learningEnabled || suggestions.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-white shadow-sm">
        <EmptyState
          title={pending === 0 ? "Você está no nível esperado em todas as competências 🎉" : "Nenhuma recomendação por enquanto"}
          description={
            pending === 0
              ? "Continue acompanhando sua evolução e as metas do seu PDI."
              : "Quando o catálogo tiver cursos ou trilhas para as competências que você está desenvolvendo, eles aparecem aqui."
          }
        />
      </section>
    );
  }
  return (
    <div className="space-y-6">
      {suggestions.map((s) => (
        <section key={s.competencyId} aria-labelledby={`rec-${s.competencyId}`} className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <CompetencyIcon icon={s.competencyIcon} />
            <div className="min-w-0">
              <h2 id={`rec-${s.competencyId}`} className="text-body font-bold text-neutral-900">
                {s.competencyName}
              </h2>
              <p className="text-caption text-neutral-600">{s.gap > 0 ? `Faltam ${s.gap} pontos para o nível esperado` : "Perto do nível esperado"}</p>
            </div>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {s.items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link href={suggestionHref(item)} className="group flex h-full items-start gap-3 rounded-lg border border-line p-4 transition-colors hover:border-purple-200 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                  <SuggestionIcon kind={item.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm font-semibold text-neutral-900">
                      {item.kind === "path" ? "Trilha" : "Curso"}: {item.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-caption text-neutral-600">{describe(item)}</span>
                    <span className="mt-2 block text-caption font-medium text-purple-700">{item.status === "in_progress" ? "Continuar" : `${Math.max(1, Math.round(item.minutes / 60))} h de conteúdo`}</span>
                  </span>
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
