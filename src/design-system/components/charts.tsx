"use client";

import { Table2, BarChart3 } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * Gráficos do design system (SVG próprio, sem dependência).
 * Regras (skill dataviz): um único eixo; marcas finas (linha 2px, coluna ≤ 24px
 * com ponta arredondada); área a ~10%; grade de 1px recessiva; legenda sempre
 * presente com ≥ 2 séries; texto nunca na cor da série; tooltip no hover e
 * alternância para TABELA (acessibilidade e o laranja com contraste < 3:1).
 * Cores categóricas em ordem FIXA: --color-chart-1..5.
 */
export const CHART_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"] as const;

type Datum = { label: string; value: number };
const fmt = new Intl.NumberFormat("pt-BR");

/** Ticks "redondos" para o eixo Y (0 / 10 / 20 / 30 …). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(6));
}

function ChartFrame({ title, description, table, children }: { title: string; description?: string; table: { headers: [string, string]; rows: [string, string][] }; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-start justify-between gap-3">
        <span>
          <span className="block text-body-sm font-semibold text-neutral-900">{title}</span>
          {description ? <span className="block text-caption text-neutral-500">{description}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-caption font-medium text-neutral-600 hover:bg-neutral-50"
        >
          {asTable ? <BarChart3 aria-hidden className="size-3.5" /> : <Table2 aria-hidden className="size-3.5" />}
          {asTable ? "Ver gráfico" : "Ver como tabela"}
        </button>
      </figcaption>
      {asTable ? (
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-line text-caption text-neutral-500">
              <th scope="col" className="py-2 font-medium">{table.headers[0]}</th>
              <th scope="col" className="py-2 text-right font-medium">{table.headers[1]}</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(([a, b]) => (
              <tr key={a} className="border-b border-line/60 last:border-0">
                <td className="py-2 text-neutral-700">{a}</td>
                <td className="py-2 text-right font-medium tabular-nums text-neutral-900">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </figure>
  );
}

const W = 560;
const PAD = { top: 12, right: 16, bottom: 28, left: 40 };

/** Linha com área — evolução no tempo (série única). */
export function AreaChart({ data, title, description, valueSuffix = "", height = 220, color = CHART_COLORS[0] }: { data: Datum[]; title: string; description?: string; valueSuffix?: string; height?: number; color?: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = useMemo(() => niceTicks(Math.max(...data.map((d) => d.value), 0)), [data]);
  const top = ticks.at(-1)!;
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const last = data.length - 1;
  const shown = hover ?? null;

  return (
    <ChartFrame title={title} description={description} table={{ headers: ["Período", "Valor"], rows: data.map((d) => [d.label, `${fmt.format(d.value)}${valueSuffix}`]) }}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={`${title}: de ${fmt.format(data[0]?.value ?? 0)}${valueSuffix} em ${data[0]?.label} a ${fmt.format(data[last]?.value ?? 0)}${valueSuffix} em ${data[last]?.label}.`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD.left) / innerW) * (data.length - 1));
            setHover(Math.max(0, Math.min(last, i)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-neutral-500 text-[11px]">
                {fmt.format(t)}
                {valueSuffix}
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={d.label} x={x(i)} y={height - 8} textAnchor="middle" className="fill-neutral-500 text-[11px]">
              {d.label}
            </text>
          ))}
          <path d={area} fill={color} opacity="0.1" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {shown !== null ? <line x1={x(shown)} x2={x(shown)} y1={PAD.top} y2={y(0)} stroke="var(--color-neutral-300)" strokeWidth="1" /> : null}
          {(shown !== null ? [shown] : [last]).map((i) => (
            <circle key={`${id}-${i}`} cx={x(i)} cy={y(data[i]!.value)} r="5" fill={color} stroke="#fff" strokeWidth="2" />
          ))}
          {shown === null && data[last] ? (
            <text x={x(last)} y={y(data[last].value) - 12} textAnchor="end" className="fill-neutral-900 text-[12px] font-semibold">
              {fmt.format(data[last].value)}
              {valueSuffix}
            </text>
          ) : null}
        </svg>
        {shown !== null && data[shown] ? (
          <div
            role="status"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-neutral-900 px-2.5 py-1.5 text-caption text-white shadow-lg"
            style={{ left: `${(x(shown) / W) * 100}%`, top: `${(y(data[shown].value) / height) * 100}%`, marginTop: -10 }}
          >
            <span className="block text-neutral-300">{data[shown].label}</span>
            <span className="font-semibold">
              {fmt.format(data[shown].value)}
              {valueSuffix}
            </span>
          </div>
        ) : null}
      </div>
    </ChartFrame>
  );
}

/** Colunas — comparação entre poucas categorias/períodos (série única). */
export function ColumnChart({ data, title, description, valueSuffix = "", height = 200, color = CHART_COLORS[0] }: { data: Datum[]; title: string; description?: string; valueSuffix?: string; height?: number; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ticks = useMemo(() => niceTicks(Math.max(...data.map((d) => d.value), 0)), [data]);
  const top = ticks.at(-1)!;
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const r = 4;

  return (
    <ChartFrame title={title} description={description} table={{ headers: ["Período", "Valor"], rows: data.map((d) => [d.label, `${fmt.format(d.value)}${valueSuffix}`]) }}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full overflow-visible" role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${fmt.format(d.value)}${valueSuffix}`).join("; ")}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-chart-grid)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-neutral-500 text-[11px]">
              {fmt.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const top = y(d.value);
          const h = y(0) - top;
          const rr = Math.min(r, h);
          const x0 = cx - barW / 2;
          const path = h > 0 ? `M${x0},${y(0)} V${top + rr} Q${x0},${top} ${x0 + rr},${top} H${x0 + barW - rr} Q${x0 + barW},${top} ${x0 + barW},${top + rr} V${y(0)} Z` : "";
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - band / 2} y={PAD.top} width={band} height={innerH} fill="transparent" />
              <path d={path} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              {hover === i ? (
                <text x={cx} y={top - 8} textAnchor="middle" className="fill-neutral-900 text-[12px] font-semibold">
                  {fmt.format(d.value)}
                  {valueSuffix}
                </text>
              ) : null}
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-neutral-500 text-[11px]">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** Rosca — parte de um todo, até 5 categorias (mais que isso: agrupe em "Outros"). */
export function DonutChart({ data, title, description, centerLabel }: { data: Datum[]; title: string; description?: string; centerLabel?: { value: string; caption: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const size = 180;
  const radius = 72;
  const stroke = 22;
  const circumference = 2 * Math.PI * radius;
  const gap = data.length > 1 ? 2 : 0; // espaço de 2px entre fatias
  const slices = data.slice(0, 5);
  const offsets = slices.map((_, i) => slices.slice(0, i).reduce((sum, d) => sum + (d.value / total) * circumference, 0));
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;

  return (
    <ChartFrame title={title} description={description} table={{ headers: ["Categoria", "Participação"], rows: data.map((d) => [d.label, `${fmt.format(d.value)} (${pct(d.value)})`]) }}>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${title}. ${data.map((d) => `${d.label}: ${pct(d.value)}`).join("; ")}.`}>
            {slices.map((d, i) => {
              const length = (d.value / total) * circumference;
              return (
                <circle
                  key={d.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={CHART_COLORS[i]}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${Math.max(0, length - gap)} ${circumference}`}
                  strokeDashoffset={-offsets[i]!}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  className="transition-[stroke-width]"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {hover !== null && data[hover] ? (
              <>
                <span className="text-h3 font-bold text-neutral-900">{pct(data[hover].value)}</span>
                <span className="text-caption text-neutral-600">{data[hover].label}</span>
              </>
            ) : centerLabel ? (
              <>
                <span className="text-h3 font-bold text-neutral-900">{centerLabel.value}</span>
                <span className="text-caption text-neutral-600">{centerLabel.caption}</span>
              </>
            ) : null}
          </div>
        </div>
        <ul className="min-w-40 flex-1 space-y-2.5" aria-label="Legenda">
          {data.slice(0, 5).map((d, i) => (
            <li key={d.label} className={cn("flex items-center gap-2.5 text-body-sm", hover !== null && hover !== i && "opacity-60")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i] }} />
              <span className="flex-1 text-neutral-700">{d.label}</span>
              <span className="font-semibold tabular-nums text-neutral-900">{pct(d.value)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
