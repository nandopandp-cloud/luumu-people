import { Building2, Clock, UsersRound, UserCheck, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Mascot } from "@/design-system/components/brand";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { cn } from "@/design-system/cn";
import { AddPersonButton } from "@/features/directory/add-person";
import { DirectoryFilters } from "@/features/directory/filters";
import { DirectoryTable } from "@/features/directory/directory-table";
import { parseDirectoryParams, toDirectoryQuery } from "@/features/directory/params";
import { Delta } from "@/features/management/dashboard";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { getManagementOverview } from "@/server/modules/management/service";
import { getDirectoryFilters, listDirectory, listManagerCandidates } from "@/server/modules/people/directory";

export const metadata: Metadata = { title: "Colaboradores" };

type SP = PageProps<"/gestao/colaboradores">["searchParams"];

export default function CollaboratorsPage({ searchParams }: PageProps<"/gestao/colaboradores">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Collaborators searchParams={searchParams} />
    </Suspense>
  );
}

const num = new Intl.NumberFormat("pt-BR");
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

/** "Hoje, 09:12" · "Ontem, 16:45" · "09/10/2026, 12:15" (horário de Brasília). */
function formatLastAccess(date: Date | null, now = new Date()) {
  if (!date) return null;
  const day = dayKey.format(date);
  if (day === dayKey.format(now)) return `Hoje, ${time.format(date)}`;
  if (day === dayKey.format(new Date(now.getTime() - 86_400_000))) return `Ontem, ${time.format(date)}`;
  return `${fullDate.format(date)}, ${time.format(date)}`;
}

async function Collaborators({ searchParams }: { searchParams: SP }) {
  const actor = await requirePermission("people.directory.read");
  const params = parseDirectoryParams(await searchParams);
  const canManage = hasTenantWide(actor, "people.manage");
  const canFilterEmployment = hasTenantWide(actor, "people.profile.read_full");
  // Sem acesso aos dados de RH, o filtro de vínculo é ignorado (nunca vira erro na página).
  const effective = canFilterEmployment ? params : { ...params, situacao: undefined };

  const [directory, filters, overview, managers] = await Promise.all([
    listDirectory(actor, toDirectoryQuery(effective)),
    getDirectoryFilters(actor),
    getManagementOverview(actor),
    canManage ? listManagerCandidates(actor) : null,
  ]);

  // Página além do fim (ex.: filtro mudou) → mostra a última com resultados.
  const last = Math.max(1, Math.ceil(directory.total / directory.perPage));
  const page = directory.page > last ? await listDirectory(actor, { ...toDirectoryQuery(effective), page: last }) : directory;

  const tenantWide = hasTenantWide(actor, "people.directory.read");
  const filtered = Boolean(params.q || params.area || params.cargo || params.situacao || params.unidade || params.nivel || params.gestor || params.status);

  const kpis: { value: number | null; label: string; hint: string; icon: LucideIcon; tone: string; change?: number | null }[] = [
    { value: overview.peopleInScope, label: tenantWide ? "Colaboradores" : "Pessoas no seu escopo", hint: overview.peopleChange === null ? "ativos" : "vs. mês anterior", icon: UsersRound, tone: "bg-purple-100 text-purple-600", change: overview.peopleChange },
    { value: overview.orgUnits, label: "Áreas", hint: "na organização", icon: Building2, tone: "bg-green-100 text-green-700" },
    { value: overview.managers, label: "Gestores", hint: "com equipe ativa", icon: UserCheck, tone: "bg-orange-100 text-orange-700" },
    { value: overview.pendingInvites, label: "Convites pendentes", hint: "aguardando aceite", icon: Clock, tone: "bg-pink-100 text-pink-700" },
  ];

  return (
    <div className="space-y-6">
      <header className="relative flex flex-wrap items-center gap-6">
        <div aria-hidden className="pointer-events-none absolute -top-10 right-40 hidden size-56 rounded-full bg-purple-100/80 blur-2xl lg:block" />
        <div className="relative min-w-0 flex-[1_1_20rem]">
          <Breadcrumb items={[{ label: "Dashboard", href: "/gestao" }, { label: "Colaboradores" }]} />
          <h1 className="mt-2 text-[2.25rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">Colaboradores</h1>
          <p className="mt-1 text-body text-neutral-600">Gerencie colaboradores, lotação, permissões e papéis de acesso.</p>
        </div>
        <div aria-hidden className="relative hidden items-start gap-2 lg:flex">
          <p className="mt-1 max-w-44 rounded-2xl rounded-br-sm bg-white px-4 py-3 text-body-sm font-medium leading-snug text-neutral-800 shadow-sm">Um time incrível transforma resultados! 💜</p>
          <Mascot className="-mb-6 h-32" />
        </div>
        {canManage ? (
          <div className="relative">
            <AddPersonButton options={{ orgUnits: filters.orgUnits, managers: managers ?? [] }} />
          </div>
        ) : null}
      </header>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis
          .filter((k) => k.value !== null)
          .map((k) => (
            <div key={k.label} className="card flex items-center gap-4 p-5">
              <span className={cn("flex size-16 shrink-0 items-center justify-center rounded-full", k.tone)}>
                <k.icon aria-hidden className="size-7" />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-h1 font-bold tabular-nums text-neutral-900">{num.format(k.value!)}</span>
                  <Delta value={k.change ?? null} />
                </p>
                <p className="text-body text-neutral-700">{k.label}</p>
                <p className="text-caption text-neutral-500">{k.hint}</p>
              </div>
            </div>
          ))}
      </section>

      <DirectoryFilters params={effective} options={filters} />

      {!tenantWide ? <p className="rounded-md bg-purple-50 px-4 py-2.5 text-body-sm text-purple-700">Você está vendo apenas as pessoas do seu escopo de acesso.</p> : null}

      <DirectoryTable
        items={page.items.map((p) => ({ ...p, lastAccess: formatLastAccess(p.lastAccessAt) }))}
        params={effective}
        counts={page.counts}
        total={page.total}
        page={Math.min(page.page, last)}
        perPage={page.perPage}
        showLastAccess={page.lastAccess}
        canExport={hasPermissionAnywhere(actor, "reports.export")}
        canManage={canManage}
        canAssignRoles={hasTenantWide(actor, "access.roles.assign")}
        actorId={actor.userId}
        filtered={filtered}
      />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Carregando colaboradores">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-xl" />
      <div className="card space-y-4 p-6">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-32 md:block" />
            <Skeleton className="hidden h-4 w-24 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
