import { AlarmClock, CircleCheck, ClipboardCheck, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/design-system/components/badge";
import { Card, CardHeader } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { cn } from "@/design-system/cn";

export function DevelopmentKpis({ kpis }: { kpis: { people: number; withPdiPercent: number; actionsDonePercent: number; actionsLate: number; averageProgress: number } }) {
  const items: { label: string; value: string; hint: string; icon: LucideIcon; tone: string }[] = [
    { label: "Pessoas acompanhadas", value: String(kpis.people), hint: "no seu escopo", icon: UsersRound, tone: "bg-purple-100 text-purple-600" },
    { label: "Com PDI ativo", value: `${kpis.withPdiPercent}%`, hint: `progresso médio de ${kpis.averageProgress}%`, icon: ClipboardCheck, tone: "bg-green-100 text-green-700" },
    { label: "Ações concluídas", value: `${kpis.actionsDonePercent}%`, hint: "de todas as ações dos PDIs", icon: CircleCheck, tone: "bg-blue-100 text-blue-700" },
    { label: "Ações atrasadas", value: String(kpis.actionsLate), hint: "precisam de atenção", icon: AlarmClock, tone: "bg-pink-100 text-pink-700" },
  ];
  return (
    <section aria-label="Indicadores de desenvolvimento" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="card flex items-center gap-4 p-5">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", k.tone)}>
            <k.icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-body-sm text-neutral-600">{k.label}</p>
            <p className="text-h2 font-bold tabular-nums text-neutral-900">{k.value}</p>
            <p className="text-caption text-neutral-600">{k.hint}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Lacunas: barra = média atual; marcador = média esperada para os cargos. */
export function CompetencyGaps({ gaps }: { gaps: { id: string; name: string; average: number | null; expected: number; assessed: number }[] }) {
  return (
    <Card>
      <CardHeader title="Lacunas de competências" description="Média atual da equipe (barra) e nível esperado para os cargos (marcador). Maiores lacunas primeiro." />
      {gaps.length === 0 ? (
        <EmptyState compact title="Sem competências cadastradas" />
      ) : (
        <ul className="space-y-4">
          {gaps.map((g) => {
            const gap = g.average === null ? null : g.expected - g.average;
            return (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-body-sm">
                  <span className="font-medium text-neutral-900">{g.name}</span>
                  <span className="text-caption text-neutral-600">
                    {g.average === null ? "Sem avaliações" : `${g.average}% de ${g.expected}%`}
                    {gap !== null && gap > 0 ? <Badge tone={gap >= 15 ? "red" : "yellow"} className="ml-2">-{gap} pts</Badge> : null}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-neutral-100" role="img" aria-label={`${g.name}: média ${g.average ?? "sem dados"}, esperado ${g.expected}`}>
                  <div className={cn("h-full rounded-full", gap !== null && gap >= 15 ? "bg-pink-500" : gap !== null && gap > 0 ? "bg-orange-500" : "bg-green-500")} style={{ width: `${g.average ?? 0}%` }} />
                  <span aria-hidden className="absolute -top-1 h-[18px] w-0.5 rounded bg-neutral-800" style={{ left: `calc(${g.expected}% - 1px)` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
