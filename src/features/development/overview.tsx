import { ArrowRight, Check, Clock3, Play, Trophy } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { CircularProgress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import type { Development } from "@/server/modules/development/service";

function StatTile({ tone, icon, value, label }: { tone: "green" | "purple" | "red"; icon: ReactNode; value: number; label: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col justify-between rounded-lg p-4", { green: "bg-green-50", purple: "bg-purple-50", red: "bg-red-50" }[tone])}>
      <span
        aria-hidden
        className={cn("flex size-9 items-center justify-center rounded-full", { green: "bg-green-500 text-white", purple: "bg-purple-200 text-purple-700", red: "bg-red-100 text-red-600" }[tone])}
      >
        {icon}
      </span>
      <p className="mt-3">
        <span className="block text-h2 font-bold tabular-nums text-neutral-900">{value}</span>
        <span className={cn("text-body-sm", tone === "red" ? "font-medium text-red-700" : tone === "purple" ? "text-purple-700" : "text-neutral-700")}>{label}</span>
      </p>
    </div>
  );
}

/** Topo da visão geral: progresso do PDI, ações por situação e competências evoluindo. */
export function OverviewStats({ development, pdiHref }: { development: Development; pdiHref: Route }) {
  const { pdi, counts, isSelf } = development;
  const stats = pdi?.stats;
  return (
    <section aria-label={isSelf ? "Resumo do meu desenvolvimento" : "Resumo do desenvolvimento"} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)_minmax(0,1fr)]">
      <div className="@container flex items-center gap-4 rounded-xl border border-line bg-white p-5 shadow-sm">
        <CircularProgress value={stats?.progress ?? 0} label="Progresso geral do PDI" size={96} stroke={11} />
        <div className="min-w-0">
          <h2 className="text-body-sm font-bold leading-snug text-neutral-900">Progresso geral do PDI</h2>
          <p className="mt-1 text-caption text-neutral-600">{stats ? `${stats.actionsDone} de ${stats.actionsTotal} ações concluídas` : "Nenhum PDI ativo"}</p>
          {pdi ? (
            <Link href={pdiHref} className="mt-3 inline-flex items-center gap-1 text-body-sm font-semibold text-purple-600 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-purple-500">
              Ver detalhes <ArrowRight aria-hidden className="size-4" />
              <span className="sr-only">do PDI</span>
            </Link>
          ) : null}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-white p-3 shadow-sm md:col-span-2 xl:col-span-1">
        <h2 className="sr-only">Ações do PDI por situação</h2>
        <div className="grid h-full grid-cols-3 gap-3">
          <StatTile tone="green" icon={<Check className="size-5" strokeWidth={3} />} value={stats?.actionsDone ?? 0} label={stats?.actionsDone === 1 ? "Concluída" : "Concluídas"} />
          <StatTile tone="purple" icon={<Play className="size-4 fill-current" />} value={stats?.actionsInProgress ?? 0} label="Em andamento" />
          <StatTile tone="red" icon={<Clock3 className="size-5" />} value={stats?.actionsLate ?? 0} label={stats?.actionsLate === 1 ? "Atrasada" : "Atrasadas"} />
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-xl border border-line bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm md:order-none">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <Trophy className="size-5" />
        </span>
        <p className="min-w-0">
          <span className="block text-h2 font-bold tabular-nums text-neutral-900">{counts.evolving}</span>
          <span className="text-body-sm text-neutral-700">{counts.evolving === 1 ? "Competência evoluindo" : "Competências evoluindo"}</span>
        </p>
      </div>
    </section>
  );
}
