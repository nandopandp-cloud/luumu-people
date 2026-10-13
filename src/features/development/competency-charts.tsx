"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { RadarChart } from "@/design-system/components/charts";
import { Modal } from "@/design-system/components/dialog";
import { Select } from "@/design-system/components/select";
import { cn } from "@/design-system/cn";
import type { CompetencyRow } from "@/server/modules/development/service";
import { LEVEL, monthName } from "./labels";

function CardHeader({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-body-sm font-bold text-neutral-900 sm:text-[15px] xl:text-body-sm 2xl:text-[15px]">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** "Meu perfil de competências": radar atual x esperado e a tabela completa em "Ver detalhado". */
export function CompetencyProfileCard({ competencies, isSelf }: { competencies: CompetencyRow[]; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const title = isSelf ? "Meu perfil de competências" : "Perfil de competências";
  return (
    <section aria-labelledby="perfil-competencias" className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <CardHeader
        id="perfil-competencias"
        title={title}
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-body-sm font-semibold text-purple-600 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-purple-500"
          >
            Ver detalhado <ArrowRight aria-hidden className="size-4" />
          </button>
        }
      />
      {competencies.length >= 3 ? (
        <RadarChart label={title} valueLabel={isSelf ? "Meu nível atual" : "Nível atual"} targetLabel="Nível esperado" items={competencies.map((c) => ({ label: c.name, value: c.score ?? 0, target: c.expected }))} />
      ) : (
        <p className="text-body-sm text-neutral-600">O perfil aparece com ao menos três competências avaliadas.</p>
      )}
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="lg"
        title={title}
        description="Nível atual e nível esperado para o cargo em cada competência."
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        }
      >
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-caption text-neutral-600">
              <th scope="col" className="py-2 font-medium">
                Competência
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Atual
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Esperado
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Diferença
              </th>
              <th scope="col" className="py-2 pl-4 font-medium">
                Situação
              </th>
            </tr>
          </thead>
          <tbody>
            {competencies.map((c) => {
              const diff = c.score === null ? null : c.score - c.expected;
              return (
                <tr key={c.id} className="border-b border-line/60 last:border-0">
                  <th scope="row" className="py-2.5 font-medium text-neutral-900">
                    {c.name}
                  </th>
                  <td className="py-2.5 text-right tabular-nums">{c.score === null ? "—" : `${c.score}%`}</td>
                  <td className="py-2.5 text-right tabular-nums">{c.expected}%</td>
                  <td className={cn("py-2.5 text-right font-semibold tabular-nums", diff === null ? "text-neutral-500" : diff >= 0 ? "text-green-700" : "text-red-700")}>
                    {diff === null ? "—" : diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="py-2.5 pl-4">
                    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", LEVEL[c.level].chip)}>{LEVEL[c.level].label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Modal>
    </section>
  );
}

const PERIODS = [
  { value: 3, label: "Últimos 3 meses" },
  { value: 6, label: "Últimos 6 meses" },
  { value: 12, label: "Últimos 12 meses" },
] as const;

const W = 300;
const H = 170;
const PAD = { left: 34, right: 14, top: 34, bottom: 24 };

/** "Evolução geral": média das competências mês a mês, com o ganho no período em destaque. */
export function CompetencyEvolutionCard({ points }: { points: { month: string; average: number | null }[] }) {
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const data = points.slice(-months).filter((p): p is { month: string; average: number } => p.average !== null);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / 100) * innerH;
  const first = data[0];
  const last = data.at(-1);
  const gain = first && last ? last.average - first.average : 0;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.average)}`).join(" ");
  const area = data.length ? `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : "";

  return (
    <section aria-labelledby="evolucao-geral" className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <CardHeader
        id="evolucao-geral"
        title="Evolução geral"
        action={
          <div className="w-40">
            <Select aria-label="Período da evolução" value={months} onChange={(e) => setMonths(Number(e.target.value) as 3 | 6 | 12)} className="h-9 text-caption">
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        }
      />
      {data.length < 2 || !first || !last ? (
        <p className="text-body-sm text-neutral-600">A evolução aparece depois de avaliações em meses diferentes.</p>
      ) : (
        <figure className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full overflow-visible"
            role="img"
            aria-label={`Média das competências: ${first.average}% em ${monthName(first.month, true)} e ${last.average}% em ${monthName(last.month, true)} (${gain >= 0 ? "+" : ""}${gain} pontos).`}
          >
            <defs>
              <linearGradient id="evolucao-geral-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--color-purple-500)" stopOpacity="0.2" />
                <stop offset="1" stopColor="var(--color-purple-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" />
                <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" className="fill-neutral-500 text-[10px]">
                  {t}%
                </text>
              </g>
            ))}
            <path d={area} fill="url(#evolucao-geral-area)" />
            <path d={line} fill="none" stroke="var(--color-purple-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <line x1={x(data.length - 1)} x2={x(data.length - 1)} y1={y(last.average)} y2={y(0)} stroke="var(--color-purple-300)" strokeDasharray="3 3" />
            {data.map((d, i) => (
              <circle key={d.month} cx={x(i)} cy={y(d.average)} r={i === data.length - 1 ? 5 : 3.5} fill="var(--color-purple-500)" stroke="#fff" strokeWidth="1.5" />
            ))}
            {data.map((d, i) => (
              <text key={d.month} x={x(i)} y={H - 6} textAnchor="middle" className="fill-neutral-500 text-[10px]">
                {monthName(d.month)}
              </text>
            ))}
          </svg>
          <div
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-purple-200 bg-white px-2.5 py-1 text-center shadow-sm"
            style={{ left: `min(${(x(data.length - 1) / W) * 100}%, calc(100% - 40px))`, top: `${(y(last.average) / H) * 100}%`, marginTop: -10 }}
          >
            <span className="block text-body-sm font-bold leading-tight text-purple-700">
              {gain >= 0 ? "+" : ""}
              {gain}%
            </span>
            <span className="block text-[10px] leading-tight text-neutral-600">de evolução</span>
          </div>
        </figure>
      )}
    </section>
  );
}
