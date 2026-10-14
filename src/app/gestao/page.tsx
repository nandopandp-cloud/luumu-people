import { ClipboardCheck, Megaphone, ShieldCheck, TrendingUp, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { ROLE_LABELS } from "@/features/audit/labels";
import {
  AttentionCard,
  attentionList,
  DashboardHero,
  DashboardRow,
  KPI_ICONS,
  KPI_TONES,
  KpiRow,
  PlatformUsageCard,
  QuickActionsCard,
  RecentActivityCard,
  type Kpi,
  type QuickAction,
} from "@/features/management/dashboard";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { listRecentActivity } from "@/server/modules/audit/service";
import { getAttentionItems, getManagementOverview } from "@/server/modules/management/service";
import { getMyProfile } from "@/server/modules/people/service";
import { getPlatformUsage, USAGE_PERIODS, type UsagePeriod } from "@/server/modules/usage/service";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/gestao">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const ROLE_PRIORITY = ["admin", "people", "editor", "manager", "employee"];

const QUICK_ACTIONS: (QuickAction & { permission: Permission })[] = [
  { title: "Gerenciar pessoas", description: "Cadastros, perfis e acessos", icon: UsersRound, tone: "purple", href: "/gestao/usuarios", permission: "people.directory.read" },
  { title: "Publicar comunicado", description: "Para toda a empresa ou áreas", icon: Megaphone, tone: "pink", href: "/gestao/comunicacao/novo", permission: "comms.announcement.create" },
  { title: "Criar pesquisa", description: "Clima, eNPS e personalizadas", icon: ClipboardCheck, tone: "green", href: "/gestao/pesquisas/nova", permission: "survey.design" },
  { title: "Ver auditoria", description: "Acompanhe ações e eventos", icon: ShieldCheck, tone: "blue", href: "/gestao/auditoria", permission: "audit.read" },
  { title: "Acompanhar desenvolvimento", description: "PDIs, metas e competências", icon: TrendingUp, tone: "green", href: "/gestao/desenvolvimento", permission: "development.read" },
];

async function Dashboard({ searchParams }: { searchParams: PageProps<"/gestao">["searchParams"] }) {
  const actor = await requirePermission("management.access");
  const raw = (await searchParams).periodo;
  const period = (USAGE_PERIODS.find((p) => String(p) === (Array.isArray(raw) ? raw[0] : raw)) ?? USAGE_PERIODS[0]) as UsagePeriod;
  const canUsage = hasTenantWide(actor, "reports.read");
  const canActivity = hasTenantWide(actor, "audit.read");

  const [profile, overview, attention, usage, activity] = await Promise.all([
    getMyProfile(actor),
    getManagementOverview(actor),
    getAttentionItems(actor),
    canUsage ? getPlatformUsage(actor, period) : null,
    canActivity ? listRecentActivity(actor, 5) : null,
  ]);

  const firstName = (profile.preferredName || profile.name).split(" ")[0]!;
  const mainRole = ROLE_PRIORITY.find((key) => actor.grants.some((g) => g.roleKey === key)) ?? "employee";
  const todayRaw = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const kpis: (Omit<Kpi, "value"> & { value: number | null })[] = [
    {
      label: overview.managers === null ? "Pessoas na sua equipe" : "Colaboradores ativos",
      value: overview.peopleInScope,
      change: overview.peopleChange,
      hint: overview.peopleChange === null ? "no seu escopo de acesso" : "vs. mês anterior",
      icon: KPI_ICONS.people,
      tone: KPI_TONES.purple,
    },
    { label: "Áreas e diretorias", value: overview.orgUnits, hint: "estrutura organizacional", icon: KPI_ICONS.org, tone: KPI_TONES.green },
    { label: "Gestores", value: overview.managers, hint: "com equipe ativa", icon: KPI_ICONS.managers, tone: KPI_TONES.orange },
    { label: "Admissões recentes", value: overview.recentHires, hint: "nos últimos 30 dias", icon: KPI_ICONS.hires, tone: KPI_TONES.pink },
  ];
  const can = (p: Permission) => hasPermissionAnywhere(actor, p);
  const quickActions = QUICK_ACTIONS.filter((a) => can(a.permission)).slice(0, 4);
  const showAttention = attention.latePdis !== null || attention.closingSurveys !== null || attention.pendingInvites !== null;

  return (
    <div className="space-y-6">
      <DashboardHero firstName={firstName} today={today} role={ROLE_LABELS[mainRole] ?? mainRole} />
      <KpiRow items={kpis.filter((k): k is Kpi => k.value !== null)} />
      <DashboardRow>
        {[usage ? <PlatformUsageCard key="usage" usage={usage} periods={USAGE_PERIODS} /> : null, showAttention ? <AttentionCard key="attention" items={attentionList(attention)} /> : null]}
      </DashboardRow>
      <DashboardRow>
        {[activity ? <RecentActivityCard key="activity" items={activity} /> : null, quickActions.length ? <QuickActionsCard key="quick" actions={quickActions} /> : null]}
      </DashboardRow>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Carregando dashboard">
      <div className="card space-y-4 p-8">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-5 w-1/2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
