import { cn } from "../cn";

/**
 * Barra e anel de progresso — styleguide "08. Progressos".
 * O valor sempre aparece também em texto (não só visualmente).
 */
const barTones = {
  purple: "bg-gradient-to-r from-purple-500 to-purple-400",
  green: "bg-green-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
} as const;

export function Progress({ value, label, tone = "purple", showValue = true, className }: { value: number; label: string; tone?: keyof typeof barTones; showValue?: boolean; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out-soft", barTones[tone])} style={{ width: `${clamped}%` }} />
      </div>
      {showValue ? <span className="w-9 text-right text-caption tabular-nums text-neutral-600">{clamped}%</span> : null}
    </div>
  );
}

export function CircularProgress({ value, label, size = 112, stroke = 12, className }: { value: number; label: string; size?: number; stroke?: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `cp-${label.replace(/\W+/g, "")}`;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-purple-500)" />
            <stop offset="100%" stopColor="var(--color-purple-300)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-purple-100)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-h2 font-bold tabular-nums text-neutral-900">{clamped}%</span>
    </div>
  );
}
