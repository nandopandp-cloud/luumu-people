import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  KeyRound,
  Megaphone,
  Network,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Mascot } from "@/design-system/components/brand";
import { Card, CardHeader, SeeAllLink } from "@/design-system/components/card";
import { ComboChart } from "@/design-system/components/charts";
import { EmptyState } from "@/design-system/components/empty-state";
import { Table, Td, Th, THead, Tr } from "@/design-system/components/table";
import { cn } from "@/design-system/cn";
import { auditLabel, describeAudit } from "@/features/audit/labels";
import { formatDateTime } from "@/lib/format";
import type { AttentionItems } from "@/server/modules/management/service";
import type { UsageDay, UsagePeriod } from "@/server/modules/usage/service";
import { UsagePeriodSelect } from "./period-select";

const num = new Intl.NumberFormat("pt-BR");
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/* ------------------------------------------------------------------ hero */

export function DashboardHero({ firstName, today, role }: { firstName: string; today: string; role: string }) {
  return (
    <section className="card relative overflow-hidden px-6 py-7 sm:px-8">
      <div aria-hidden className="absolute -right-16 -top-24 size-80 rounded-full bg-purple-100/70 blur-2xl" />
      <div className="relative flex items-center gap-6">
        <div className="min-w-0 flex-1">
          <p className="mb-3 flex flex-wrap items-center gap-3 text-caption text-neutral-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays aria-hidden className="size-4" /> {today}
            </span>
            <Badge tone="purple">{role}</Badge>
          </p>
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900 sm:text-display">
            Olá, {firstName}! <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-body text-neutral-600">Visão geral da plataforma e atividades recentes.</p>
        </div>
        <div aria-hidden className="relative hidden shrink-0 items-start gap-2 md:flex">
          <p className="mt-2 max-w-40 rounded-2xl rounded-br-sm bg-white px-4 py-3 text-caption font-medium leading-snug text-neutral-800 shadow-sm">
            Pessoas mais engajadas fazem uma empresa mais forte! 💜
          </p>
          <Mascot className="h-32" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ KPIs */

export function Delta({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-0.5 rounded-full px-2 py-0.5 text-caption font-semibold tabular-nums",
        flat ? "bg-neutral-100 text-neutral-600" : up ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700",
      )}
    >
      {flat ? null : up ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
      <span className="sr-only">{flat ? "estável, " : up ? "alta de " : "queda de "}</span>
      {up && value > 0 ? "+" : ""}
      {pct.format(Math.abs(value))}
      {suffix}
    </span>
  );
}

export type Kpi = { label: string; value: number; hint: string; icon: LucideIcon; tone: string; change?: number | null };

export const KPI_TONES = {
  purple: "bg-purple-100 text-purple-600",
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  pink: "bg-pink-100 text-pink-700",
} as const;

export function KpiRow({ items }: { items: Kpi[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="card flex items-center gap-4 p-5">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", k.tone)}>
            <k.icon aria-hidden className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-body-sm text-neutral-600">{k.label}</p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-h1 font-bold tabular-nums text-neutral-900">{num.format(k.value)}</span>
              <Delta value={k.change ?? null} />
            </p>
            <p className="text-caption text-neutral-500">{k.hint}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export const KPI_ICONS = { people: UsersRound, org: Network, managers: UserCheck, hires: CalendarDays };

/* ------------------------------------------------- visão da plataforma */

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "12 min", "1 h 05 min" ou "menos de 1 min". */
export function formatUsageTime(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (seconds > 0 && minutes === 0) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

type Usage = {
  period: UsagePeriod;
  days: UsageDay[];
  totals: { visits: number; users: number; avgSeconds: number };
  changes: { visits: number | null; users: number | null; avgSeconds: number | null };
};

export function PlatformUsageCard({ usage, periods }: { usage: Usage; periods: readonly UsagePeriod[] }) {
  const comparedTo = usage.period === 7 ? "vs. semana anterior" : `vs. ${usage.period} dias anteriores`;
  const stats = [
    { label: "Acessos", value: num.format(usage.totals.visits), change: usage.changes.visits, swatch: "bg-purple-400" },
    { label: "Usuários únicos", value: num.format(usage.totals.users), change: usage.changes.users, swatch: "bg-purple-700" },
    { label: "Tempo médio de uso", value: formatUsageTime(usage.totals.avgSeconds), change: usage.changes.avgSeconds, swatch: null },
  ];
  const data = usage.days.map((d) => {
    const date = new Date(`${d.day}T12:00:00Z`);
    const short = usage.period === 7 ? capitalize(weekday.format(date).replace(".", "")) : dayMonth.format(date);
    return { label: short, fullLabel: capitalize(longDay.format(date)), bar: d.visits, line: d.users };
  });
  const empty = usage.totals.visits === 0;

  return (
    <Card aria-labelledby="visao-plataforma">
      <CardHeader
        id="visao-plataforma"
        title="Visão da plataforma"
        description="Acompanhe o volume de acessos e a atividade dos colaboradores."
        action={<div className="w-40 shrink-0"><UsagePeriodSelect value={usage.period} options={periods} /></div>}
      />
      <dl className="mb-5 grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-line">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0 sm:pl-4 sm:first:pl-0">
            <dt className="flex items-center gap-2 text-caption text-neutral-600">
              {s.swatch ? <span aria-hidden className={cn("size-2.5 rounded-full", s.swatch)} /> : <Clock aria-hidden className="size-3.5 text-neutral-500" />}
              {s.label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-h2 font-bold tabular-nums text-neutral-900">{s.value}</span>
              {s.change !== null ? (
                <span className="flex flex-col gap-0.5">
                  <Delta value={s.change} />
                  <span className="text-[11px] text-neutral-500">{comparedTo}</span>
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
      {empty ? (
        <EmptyState compact title="Ainda sem acessos no período" description="Os acessos aparecem aqui conforme as pessoas usam a plataforma." />
      ) : (
        <ComboChart height={190} data={data} title={`Acessos e usuários únicos por dia, últimos ${usage.period} dias`} barLabel="Acessos" lineLabel="Usuários únicos" />
      )}
    </Card>
  );
}

/* --------------------------------------------------- atenção necessária */

const listFormat = new Intl.ListFormat("pt-BR", { style: "long", type: "conjunction" });

type Attention = { key: string; title: string; description: string; href: Route; icon: LucideIcon; tone: { box: string; icon: string } };

const ATTENTION_TONES = {
  red: { box: "bg-red-50", icon: "bg-white text-red-600" },
  orange: { box: "bg-orange-50", icon: "bg-white text-orange-600" },
  blue: { box: "bg-blue-50", icon: "bg-white text-blue-700" },
};

export function attentionList(items: AttentionItems): Attention[] {
  const list: Attention[] = [];
  if (items.latePdis) {
    list.push({
      key: "pdis",
      title: `${items.latePdis} ${items.latePdis === 1 ? "PDI com ações atrasadas" : "PDIs com ações atrasadas"}`,
      description: "Ações que deveriam ter sido concluídas.",
      href: "/gestao/desenvolvimento",
      icon: Clock,
      tone: ATTENTION_TONES.red,
    });
  }
  if (items.closingSurveys?.length) {
    const n = items.closingSurveys.length;
    list.push({
      key: "surveys",
      title: `${n} ${n === 1 ? "pesquisa encerra" : "pesquisas encerram"} nos próximos 7 dias`,
      description: listFormat.format(items.closingSurveys.map((s) => s.title)),
      href: "/gestao/pesquisas",
      icon: BarChart3,
      tone: ATTENTION_TONES.orange,
    });
  }
  if (items.pendingInvites) {
    list.push({
      key: "invites",
      title: `${items.pendingInvites} ${items.pendingInvites === 1 ? "acesso aguardando ativação" : "acessos aguardando ativação"}`,
      description: "Pessoas convidadas que ainda não entraram na plataforma.",
      href: "/gestao/colaboradores?status=pendentes" as Route,
      icon: UsersRound,
      tone: ATTENTION_TONES.blue,
    });
  }
  return list;
}

export function AttentionCard({ items }: { items: Attention[] }) {
  return (
    <Card aria-labelledby="atencao-necessaria">
      <CardHeader
        id="atencao-necessaria"
        title={
          <span className="flex items-center gap-2">
            Atenção necessária
            {items.length ? (
              <Badge tone="red" aria-label={`${items.length} ${items.length === 1 ? "item" : "itens"}`}>
                {items.length}
              </Badge>
            ) : null}
          </span>
        }
        description="Itens que precisam da sua atenção no momento."
      />
      {items.length === 0 ? (
        <EmptyState compact title="Tudo em dia por aqui" description="Nenhuma pendência no momento." />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-4", item.tone.box)}>
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full shadow-sm", item.tone.icon)}>
                <item.icon aria-hidden className="size-5" />
              </span>
              <div className="min-w-0 flex-1 basis-44">
                <p className="text-body-sm font-bold text-neutral-900">{item.title}</p>
                <p className="line-clamp-2 text-caption text-neutral-600">{item.description}</p>
              </div>
              <Link
                href={item.href}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full text-body-sm font-medium text-purple-600 hover:text-purple-700 hover:underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-purple-500"
              >
                Ver detalhes <ArrowRight aria-hidden className="size-4" />
                <span className="sr-only">: {item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------------------------------------------------- atividade recente */

const ACTION_ICONS: [prefix: string, icon: LucideIcon][] = [
  ["comms.", Megaphone],
  ["survey.", ClipboardCheck],
  ["access.", KeyRound],
  ["people.", UserCog],
  ["development.", TrendingUp],
  ["org.", Network],
  ["tenant.", Settings],
  ["file.", FileText],
];
const actionIcon = (action: string) => ACTION_ICONS.find(([prefix]) => action.startsWith(prefix))?.[1] ?? ShieldCheck;

type Activity = { id: string; action: string; metadata: Record<string, unknown>; createdAt: Date; actorName: string | null; actorImage: string | null; targetName: string | null };

export function RecentActivityCard({ items }: { items: Activity[] }) {
  return (
    <Card aria-labelledby="atividade-recente">
      <CardHeader
        id="atividade-recente"
        title="Atividade recente"
        description="Acompanhe as principais ações realizadas na plataforma."
        action={<SeeAllLink href="/gestao/auditoria">Ver auditoria completa</SeeAllLink>}
      />
      {items.length === 0 ? (
        <EmptyState compact title="Nada por aqui ainda" description="As ações importantes da plataforma vão aparecer aqui." />
      ) : (
        <Table>
          <caption className="sr-only">Últimas ações na plataforma</caption>
          <THead>
            <tr>
              <Th>Usuário</Th>
              <Th>Ação</Th>
              <Th>Detalhes</Th>
              <Th className="text-right">Data e hora</Th>
            </tr>
          </THead>
          <tbody>
            {items.map((item) => {
              const Icon = actionIcon(item.action);
              const who = item.actorName ?? "Sistema";
              return (
                <Tr key={item.id}>
                  <Td data-label="Usuário">
                    <span className="inline-flex items-center gap-2.5">
                      <Avatar name={who} src={item.actorImage} size="sm" />
                      <span className="font-medium text-neutral-900">{who}</span>
                    </span>
                  </Td>
                  <Td data-label="Ação">
                    <span className="inline-flex items-center gap-2">
                      <Icon aria-hidden className="size-4 shrink-0 text-neutral-500" />
                      {auditLabel(item.action)}
                    </span>
                  </Td>
                  <Td data-label="Detalhes" className="max-w-56 truncate text-neutral-500">
                    {describeAudit(item) ?? "—"}
                  </Td>
                  <Td data-label="Data e hora" className="whitespace-nowrap tabular-nums text-neutral-500 md:text-right">
                    <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

/* --------------------------------------------------------- ações rápidas */

export type QuickAction = { title: string; description: string; href: Route; icon: LucideIcon; tone: keyof typeof QUICK_TONES };

const QUICK_TONES = {
  purple: { box: "bg-purple-50 hover:border-purple-200", icon: "bg-purple-100 text-purple-600" },
  pink: { box: "bg-pink-50 hover:border-pink-100", icon: "bg-pink-100 text-pink-700" },
  green: { box: "bg-green-50 hover:border-green-100", icon: "bg-green-100 text-green-700" },
  blue: { box: "bg-blue-50 hover:border-blue-100", icon: "bg-blue-100 text-blue-700" },
};

export function QuickActionsCard({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Card aria-labelledby="acoes-rapidas">
      <CardHeader id="acoes-rapidas" title="Ações rápidas" description="Acesse as principais funcionalidades." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <li key={a.title}>
            <Link
              href={a.href}
              className={cn(
                "flex h-full items-center gap-2.5 rounded-xl border border-transparent p-3 transition-colors focus-visible:outline-2 focus-visible:outline-purple-500",
                QUICK_TONES[a.tone].box,
              )}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", QUICK_TONES[a.tone].icon)}>
                <a.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold text-neutral-900">{a.title}</span>
                <span className="block text-caption text-neutral-600">{a.description}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500 sm:hidden" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Duas colunas quando há dois cards; um só ocupa a linha inteira. */
export function DashboardRow({ children }: { children: ReactNode[] }) {
  const present = children.filter(Boolean);
  if (present.length === 0) return null;
  return <div className={cn("grid gap-6", present.length > 1 && "xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]")}>{present}</div>;
}
