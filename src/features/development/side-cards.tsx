import { ArrowDown, ArrowRight, ArrowUp, Target } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { CircularProgress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { HexBadge } from "@/design-system/illustrations/hex-badge";
import { MoodArt } from "@/features/wellbeing/mood-art";
import type { CompetencyMilestone, CompetencyRow, PdiTimelinePoint } from "@/server/modules/development/service";
import { COMPETENCY_ICONS, competencyTone, levelName, monthName } from "./labels";

/** Cartão lateral dos mockups: título forte e o atalho "Ver todas →". */
export function SideCard({ id, title, href, linkLabel = "Ver todas", children, className }: { id: string; title: string; href?: Route; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-xl border border-line bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-body font-bold text-neutral-900">
          {title}
        </h2>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-purple-600 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-purple-500">
            {linkLabel} <ArrowRight aria-hidden className="size-4" />
            <span className="sr-only">: {title}</span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CompetencyIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = COMPETENCY_ICONS[icon ?? ""] ?? Target;
  const tone = competencyTone(icon);
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone.tile, className)}>
      <Icon className={cn("size-5", tone.icon)} />
    </span>
  );
}

/** Variação desde a avaliação anterior ("↑ 12%"). */
function Delta({ value }: { value: number | null }) {
  if (!value) return <span aria-hidden className="w-14" />;
  const up = value > 0;
  return (
    <span className={cn("inline-flex w-14 shrink-0 items-center justify-center gap-0.5 rounded-full py-1 text-caption font-semibold tabular-nums", up ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700")}>
      {up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
      {Math.abs(value)}%<span className="sr-only">{up ? " a mais que na avaliação anterior" : " a menos que na avaliação anterior"}</span>
    </span>
  );
}

/** As competências do PDI primeiro (na ordem das metas), depois as que mais evoluíram. */
export function focusCompetencies(competencies: CompetencyRow[], goalCompetencyIds: (string | null)[], limit = 4) {
  const order = goalCompetencyIds.filter((id): id is string => Boolean(id));
  return [...competencies]
    .sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return (b.delta ?? 0) - (a.delta ?? 0) || (b.score ?? 0) - (a.score ?? 0);
    })
    .slice(0, limit);
}

export function CompetenciesCard({ id, title, competencies, href }: { id: string; title: string; competencies: CompetencyRow[]; href: Route }) {
  return (
    <SideCard id={id} title={title} href={href}>
      {competencies.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nenhuma competência avaliada ainda.</p>
      ) : (
        <ul className="space-y-4">
          {competencies.map((c) => (
            <li key={c.id} className="flex items-center gap-3">
              <CompetencyIcon icon={c.icon} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm text-neutral-800">{c.name}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <div role="progressbar" aria-label={c.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.score ?? 0} className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-400" style={{ width: `${c.score ?? 0}%` }} />
                  </div>
                  <span className="w-9 text-right text-caption tabular-nums text-neutral-700">{c.score === null ? "—" : `${c.score}%`}</span>
                </div>
              </div>
              <Delta value={c.delta} />
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  );
}

/* --------------------------------------------------------- evolução */

const W = 300;
const H = 150;
const PAD = { left: 12, right: 12, top: 40, bottom: 26 };

/** Curva suave pelos pontos (Catmull-Rom → Bézier). */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** "Minha evolução": progresso do PDI mês a mês, com o mês atual em destaque. */
export function EvolutionCard({ id, title, timeline, href }: { id: string; title: string; timeline: PdiTimelinePoint[]; href?: Route }) {
  if (timeline.length < 2) {
    return (
      <SideCard id={id} title={title} href={href} linkLabel="Ver histórico">
        <p className="text-body-sm text-neutral-600">A evolução aparece aqui conforme os meses do ciclo passam.</p>
      </SideCard>
    );
  }
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const points = timeline.map((p, i) => ({ x: PAD.left + (i * innerW) / (timeline.length - 1), y: PAD.top + innerH - (p.progress / 100) * innerH }));
  const line = smoothPath(points);
  const area = `${line} L${points.at(-1)!.x},${PAD.top + innerH} L${points[0]!.x},${PAD.top + innerH} Z`;
  const last = timeline.at(-1)!;
  const lastPoint = points.at(-1)!;
  const summary = `Progresso do PDI: ${timeline[0]!.progress}% em ${monthName(timeline[0]!.month, true)} e ${last.progress}% em ${monthName(last.month, true)}.`;
  return (
    <SideCard id={id} title={title} href={href} linkLabel="Ver histórico">
      <figure className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label={summary}>
          <defs>
            <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--color-purple-500)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--color-purple-500)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="var(--color-chart-grid)" />
          <path d={area} fill={`url(#${id}-area)`} />
          <path d={line} fill="none" stroke="var(--color-purple-500)" strokeWidth="2.5" strokeLinecap="round" />
          <line x1={lastPoint.x} x2={lastPoint.x} y1={lastPoint.y} y2={PAD.top + innerH} stroke="var(--color-purple-300)" strokeDasharray="3 3" />
          {points.map((p, i) => (
            <circle key={timeline[i]!.month} cx={p.x} cy={p.y} r={i === points.length - 1 ? 5.5 : 4} fill={i === points.length - 1 ? "var(--color-purple-500)" : "#fff"} stroke="var(--color-purple-500)" strokeWidth="2" />
          ))}
          {timeline.map((p, i) => (
            <text key={p.month} x={points[i]!.x} y={H - 6} textAnchor="middle" className="fill-neutral-500 text-[11px]">
              {monthName(p.month)}
            </text>
          ))}
        </svg>
        {/* Destaque do mês atual (o mesmo valor está no rótulo do gráfico). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-center shadow-sm"
          style={{ left: `min(${(lastPoint.x / W) * 100}%, calc(100% - 34px))`, top: `${(lastPoint.y / H) * 100}%`, marginTop: -10 }}
        >
          <span className="block text-body-sm font-bold leading-tight text-purple-700">{last.progress}%</span>
          <span className="block text-[10px] leading-tight text-neutral-600">{monthName(last.month, true)}</span>
        </div>
      </figure>
    </SideCard>
  );
}

/** "Meu progresso": anel do PDI e ações concluídas por mês (mês atual em destaque). */
export function ProgressMonthsCard({ id, title, stats, timeline, href }: { id: string; title: string; stats: { actionsDone: number; actionsTotal: number; progress: number }; timeline: PdiTimelinePoint[]; href?: Route }) {
  const max = Math.max(1, ...timeline.map((p) => p.completed));
  return (
    <SideCard id={id} title={title} href={href} linkLabel="Ver detalhes">
      <div className="flex items-center gap-5">
        <CircularProgress value={stats.progress} label="Progresso do PDI" size={96} stroke={10} />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-neutral-700">
            {stats.actionsDone} de {stats.actionsTotal} ações concluídas
          </p>
          {timeline.length ? (
            <>
              <ul aria-hidden className="mt-3 flex h-16 items-end justify-between gap-1.5">
                {timeline.map((p, i) => (
                  <li key={p.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span
                      className={cn("w-full max-w-5 rounded-t-md", i === timeline.length - 1 ? "bg-purple-500" : p.completed ? "bg-purple-300" : "bg-purple-100")}
                      style={{ height: `${Math.max(8, (p.completed / max) * 100)}%` }}
                    />
                  </li>
                ))}
              </ul>
              <div aria-hidden className="mt-1 flex justify-between gap-1.5">
                {timeline.map((p) => (
                  <span key={p.month} className="flex-1 text-center text-[11px] text-neutral-500">
                    {monthName(p.month)}
                  </span>
                ))}
              </div>
              <ul className="sr-only">
                {timeline.map((p) => (
                  <li key={p.month}>
                    {monthName(p.month, true)}: {p.completed} {p.completed === 1 ? "ação concluída" : "ações concluídas"}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </SideCard>
  );
}

/** Conquistas: cada nível de proficiência inédito numa competência. */
export function AchievementsCard({ id, title, milestones, href, limit = 3 }: { id: string; title: string; milestones: CompetencyMilestone[]; href: Route; limit?: number }) {
  const recent = milestones.slice(0, limit);
  return (
    <SideCard id={id} title={title} href={href}>
      {recent.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Suas conquistas aparecem quando uma competência sobe de nível.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 text-center">
          {recent.map((m) => (
            <li key={`${m.competencyId}-${m.level}`} className="flex flex-col items-center">
              <HexBadge icon={m.icon} theme={competencyTone(m.icon).badge} className="size-14" />
              <p className="mt-2 line-clamp-2 text-caption font-semibold leading-tight text-neutral-900">{m.name}</p>
              <p className="text-[11px] text-neutral-600">
                Nível {m.level}
                <span className="sr-only"> ({levelName(m.level)})</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  );
}

/** Incentivo do rodapé da coluna: leva ao PDI. */
export function KeepGoingCard({ href }: { href: Route }) {
  return (
    <section aria-labelledby="incentivo-pdi" className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-gradient-to-r from-purple-50 to-purple-100 p-4 shadow-sm">
      <MoodArt slug="ola-maos" className="size-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="incentivo-pdi" className="text-body-sm font-bold leading-snug text-neutral-900">
          Pequenas ações geram grandes resultados!
        </h2>
        <p className="mt-0.5 text-caption text-neutral-600">Continue evoluindo no seu PDI.</p>
      </div>
      <Link
        href={href}
        aria-label="Abrir o PDI"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-purple-200 text-purple-700 transition-colors hover:bg-purple-500 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
      >
        <ArrowRight aria-hidden className="size-5" />
      </Link>
    </section>
  );
}
