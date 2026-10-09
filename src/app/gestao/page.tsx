import { BookOpenCheck, CalendarDays, ChevronRight, Megaphone, Network, ShieldCheck, TrendingUp, UserCheck, UsersRound, Waypoints, type LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Mascot } from "@/design-system/components/brand";
import { Card, CardHeader, SeeAllLink } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { auditLabel, ROLE_LABELS } from "@/features/audit/labels";
import { formatDateTime } from "@/lib/format";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { listAuditLogs } from "@/server/modules/audit/service";
import { getManagementOverview } from "@/server/modules/management/service";
import { getMyProfile } from "@/server/modules/people/service";
import { getEnabledModules } from "@/server/modules/flags/modules";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

const ROLE_PRIORITY = ["admin", "people", "editor", "manager", "employee"];

async function Dashboard() {
  const actor = await requirePermission("management.access");
  const [profile, overview, modules] = await Promise.all([getMyProfile(actor), getManagementOverview(actor), getEnabledModules(actor)]);
  const firstName = (profile.preferredName || profile.name).split(" ")[0];
  const mainRole = ROLE_PRIORITY.find((key) => actor.grants.some((g) => g.roleKey === key)) ?? "employee";
  const todayRaw = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const kpis: { label: string; value: number | null; icon: LucideIcon; tone: string; hint: string }[] = [
    { label: overview.managers === null ? "Pessoas na sua equipe" : "Colaboradores ativos", value: overview.peopleInScope, icon: UsersRound, tone: "bg-purple-100 text-purple-600", hint: "no seu escopo de acesso" },
    { label: "Áreas e diretorias", value: overview.orgUnits, icon: Network, tone: "bg-green-100 text-green-700", hint: "estrutura organizacional" },
    { label: "Gestores", value: overview.managers, icon: UserCheck, tone: "bg-orange-100 text-orange-700", hint: "com equipe vigente" },
    { label: "Pessoas que acessaram", value: overview.weeklyLogins, icon: CalendarDays, tone: "bg-pink-100 text-pink-700", hint: "nos últimos 7 dias" },
  ];
  const visibleKpis = kpis.filter((k) => k.value !== null);

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-6">
        <section className="card relative overflow-hidden px-6 py-7 sm:px-8">
          <div aria-hidden className="absolute -right-10 -top-20 size-72 rounded-full bg-purple-100/70 blur-2xl" />
          <div className="relative flex items-end gap-6">
            <div className="min-w-0 flex-1">
              <p className="mb-3 flex flex-wrap items-center gap-3 text-caption text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden className="size-4" /> {today}
                </span>
                <Badge tone="purple">{ROLE_LABELS[mainRole]}</Badge>
              </p>
              <h1 className="text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900 sm:text-display">
                Olá, {firstName}! <span aria-hidden>👋</span>
              </h1>
              <p className="mt-3 max-w-xl text-body text-neutral-600">Aqui está um resumo da plataforma. Continue transformando o aprendizado em grandes conquistas!</p>
            </div>
            <Mascot className="relative hidden h-36 shrink-0 md:block" />
          </div>
        </section>

        {visibleKpis.length > 0 ? (
          <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleKpis.map((k) => (
              <div key={k.label} className="card flex items-center gap-4 p-5">
                <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-full", k.tone)}>
                  <k.icon aria-hidden className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-body-sm text-neutral-600">{k.label}</p>
                  <p className="text-h1 font-bold tabular-nums text-neutral-900">{k.value!.toLocaleString("pt-BR")}</p>
                  <p className="text-caption text-neutral-500">{k.hint}</p>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {modules.learning ? (
          <Card>
            <CardHeader title="Engajamento e aprendizagem" description="Acessos, conclusões, tempo de uso e distribuição por perfil." />
            <EmptyState compact title="Os indicadores de aprendizagem chegam com os cursos" description="Assim que cursos, trilhas e conteúdos forem publicados, o engajamento aparece aqui." />
          </Card>
        ) : null}
      </div>

      <aside className="space-y-6" aria-label="Atalhos e atividade">
        <QuickActions can={(p) => hasPermissionAnywhere(actor, p)} learning={modules.learning} />
        {hasTenantWide(actor, "audit.read") ? (
          <Suspense fallback={<ListSkeleton />}>
            <RecentActivity />
          </Suspense>
        ) : null}
      </aside>
    </div>
  );
}

function QuickActions({ can, learning }: { can: (p: Permission) => boolean; learning: boolean }) {
  const actions: { title: string; description: string; icon: LucideIcon; tone: string; href?: Route; permission: Permission; learning?: boolean }[] = [
    { title: "Acompanhar desenvolvimento", description: "PDIs, metas e competências", icon: TrendingUp, tone: "bg-green-100 text-green-700", href: "/gestao/desenvolvimento", permission: "development.read" },
    { title: "Gerenciar usuários", description: "Consulte pessoas e papéis de acesso", icon: UsersRound, tone: "bg-purple-100 text-purple-600", href: "/gestao/usuarios", permission: "people.directory.read" },
    { title: "Ver auditoria", description: "Acompanhe ações sensíveis", icon: ShieldCheck, tone: "bg-blue-100 text-blue-700", href: "/gestao/auditoria", permission: "audit.read" },
    { title: "Criar novo curso", description: "Monte um curso do zero", icon: BookOpenCheck, tone: "bg-orange-100 text-orange-700", permission: "content.course.create", learning: true },
    { title: "Criar nova trilha", description: "Organize jornadas de aprendizado", icon: Waypoints, tone: "bg-green-100 text-green-700", permission: "content.path.manage", learning: true },
    { title: "Novo comunicado", description: "Publique para a empresa ou áreas", icon: Megaphone, tone: "bg-pink-100 text-pink-700", permission: "comms.announcement.create" },
  ];
  const visible = actions.filter((a) => can(a.permission) && (!a.learning || learning));
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Ações rápidas" />
      <ul className="space-y-3">
        {visible.map((a) => {
          const inner = (
            <>
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", a.tone)}>
                <a.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm font-semibold text-neutral-900">{a.title}</span>
                <span className="block text-caption text-neutral-600">{a.description}</span>
              </span>
              {a.href ? <ChevronRight aria-hidden className="size-4 text-neutral-500" /> : <Badge tone="neutral">Em breve</Badge>}
            </>
          );
          return (
            <li key={a.title}>
              {a.href ? (
                <Link href={a.href} className="flex items-center gap-3 rounded-lg border border-line p-3 transition-colors hover:border-purple-200 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-line p-3 opacity-80" aria-disabled>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

async function RecentActivity() {
  const actor = await requirePermission("audit.read");
  const { items } = await listAuditLogs(actor, { limit: 6 });
  return (
    <Card>
      <CardHeader title="Atividade recente" action={<SeeAllLink href="/gestao/auditoria">Ver todas</SeeAllLink>} />
      {items.length === 0 ? (
        <EmptyState compact title="Nada por aqui ainda" description="As ações importantes da plataforma vão aparecer aqui." />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <Avatar name={item.actorName ?? "Sistema"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold text-neutral-900">{auditLabel(item.action)}</p>
                <p className="truncate text-caption text-neutral-500">{item.actorName ?? "Sistema"}</p>
              </div>
              <time className="shrink-0 text-caption text-neutral-500" dateTime={item.createdAt.toISOString()}>
                {formatDateTime(item.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="card space-y-4 p-6" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
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
    </div>
  );
}
