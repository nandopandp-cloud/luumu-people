import { Briefcase, Building2, CalendarDays, FileBadge, Hash, Mail, MapPin, Network, Phone, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Mascot } from "@/design-system/components/brand";
import { Card, CardHeader } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { LinkTabs } from "@/design-system/components/link-tabs";
import { ComingSoon } from "@/features/page/coming-soon";
import { AvatarUploadButton, CoverUploadButton } from "@/features/profile/avatar-upload";
import { ChangePasswordForm } from "@/features/profile/change-password-form";
import { EditProfileDialog } from "@/features/profile/edit-profile-dialog";
import { CONTRACT_LABELS, formatDate, formatLocation } from "@/lib/format";
import { requireActor } from "@/server/dal";
import { getDevelopment } from "@/server/modules/development/service";
import { getEnabledModules } from "@/server/modules/flags/modules";
import { CompetencyBarsCard, GoalsCard, OverviewCards } from "@/features/development/sections";
import { getMyProfile } from "@/server/modules/people/service";

export const metadata: Metadata = { title: "Meu perfil" };

const TABS = [
  { value: "visao-geral", label: "Visão geral" },
  { value: "meus-dados", label: "Meus dados" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
  { value: "conquistas", label: "Conquistas" },
  { value: "certificados", label: "Certificados" },
  { value: "historico", label: "Histórico" },
] as const;

type Tab = (typeof TABS)[number]["value"];
type Profile = Awaited<ReturnType<typeof getMyProfile>>;

export default function ProfilePage({ searchParams }: PageProps<"/meu-perfil">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ searchParams }: { searchParams: PageProps<"/meu-perfil">["searchParams"] }) {
  const actor = await requireActor();
  const [profile, params, modules] = await Promise.all([getMyProfile(actor), searchParams, getEnabledModules(actor)]);
  const tabs = TABS.filter((t) => t.value !== "certificados" || modules.learning);
  const tab: Tab = tabs.some((t) => t.value === params.aba) ? (params.aba as Tab) : "visao-geral";

  return (
    <>
      <ProfileHeader profile={profile} />
      <div className="mb-6">
        <LinkTabs label="Seções do perfil" current={tab} items={tabs.map((t) => ({ ...t, href: { pathname: "/meu-perfil", query: t.value === "visao-geral" ? {} : { aba: t.value } } }))} />
      </div>
      {tab === "visao-geral" ? <Overview profile={profile} development={await getDevelopment(actor)} /> : null}
      {tab === "meus-dados" ? <MyData profile={profile} /> : null}
      {tab === "desenvolvimento" ? <ProfileDevelopment development={await getDevelopment(actor)} /> : null}
      {tab === "conquistas" ? (
        <ComingSoon title="Suas conquistas vão aparecer aqui" description="Selos, níveis e marcos da sua jornada." phase="Chega na Fase 2 · Experiência do colaborador" />
      ) : null}
      {tab === "certificados" ? (
        <ComingSoon title="Seus certificados vão ficar guardados aqui" description="Certificados dos cursos e trilhas concluídos, prontos para baixar." phase="Chega na Fase 2 · Experiência do colaborador" />
      ) : null}
      {tab === "historico" ? (
        <ComingSoon title="Seu histórico está a caminho" description="Mudanças de área e cargo e PDIs concluídos ao longo da sua trajetória." phase="Chega na Fase 2 · Experiência do colaborador" />
      ) : null}
    </>
  );
}

function ProfileHeader({ profile }: { profile: Profile }) {
  const location = formatLocation(profile.city, profile.state);
  return (
    <section className="relative mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 via-[#ece5fc] to-purple-200 px-6 py-7 sm:px-8">
      {profile.profileCover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API */}
          <img src={profile.profileCover} alt="" className="absolute inset-0 size-full object-cover" />
          {/* Véu claro para manter o texto legível sobre qualquer imagem. */}
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/75 to-white/20" />
        </>
      ) : (
        <div aria-hidden className="absolute -right-8 -top-16 size-72 rounded-full bg-white/40 blur-2xl" />
      )}
      <div className="absolute right-4 top-4 z-10">
        <CoverUploadButton hasCover={Boolean(profile.profileCover)} />
      </div>
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative shrink-0 self-start">
          <Avatar name={profile.name} src={profile.image} size="xl" className="shadow-md ring-0" />
          {profile.editableFields.includes("image") ? <AvatarUploadButton /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900 sm:text-[2.25rem]">{profile.preferredName || profile.name}</h1>
          <p className="mt-1 text-body text-neutral-700">{profile.position ?? "—"}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-neutral-700">
            {profile.orgUnit ? (
              <li className="flex items-center gap-1.5">
                <Network aria-hidden className="size-4 text-neutral-500" />
                <span className="sr-only">Área:</span> {profile.orgUnit}
              </li>
            ) : null}
            {profile.directorate ? (
              <li className="flex items-center gap-1.5">
                <Building2 aria-hidden className="size-4 text-neutral-500" />
                <span className="sr-only">Diretoria:</span> {profile.directorate}
              </li>
            ) : null}
            {location !== "—" ? (
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4 text-neutral-500" />
                <span className="sr-only">Localização:</span> {location}
              </li>
            ) : null}
          </ul>
          {profile.headline ? <p className="mt-4 max-w-xl text-body italic text-neutral-700">“{profile.headline}”</p> : null}
        </div>
        <div aria-hidden className={profile.profileCover ? "hidden" : "relative hidden h-40 w-56 shrink-0 lg:block"}>
          <div className="absolute -left-4 top-0 max-w-40 rounded-lg border border-line bg-white px-4 py-3 text-body-sm font-medium leading-snug text-neutral-800 shadow-md">
            Grandes trajetórias são construídas com pequenos aprendizados! <span className="text-purple-500">💜</span>
          </div>
          <Mascot className="absolute bottom-0 right-0 h-32" />
        </div>
      </div>
    </section>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <dt className="flex w-48 shrink-0 items-center gap-4 text-body-sm text-neutral-600">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
          <Icon className="size-[18px]" />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 truncate text-body-sm font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function ProfileDevelopment({ development }: { development: Awaited<ReturnType<typeof getDevelopment>> }) {
  return (
    <div className="space-y-6">
      <OverviewCards development={development} pdiHref={"/desenvolvimento?aba=pdi" as Route} />
      <div className="grid gap-6 xl:grid-cols-2">
        <GoalsCard development={development} pdiHref={"/desenvolvimento?aba=pdi" as Route} />
        <CompetencyBarsCard development={development} href={"/desenvolvimento?aba=competencias" as Route} />
      </div>
    </div>
  );
}

function Overview({ profile, development }: { profile: Profile; development: Awaited<ReturnType<typeof getDevelopment>> }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          title="Minhas informações"
          action={<EditProfileDialog editable={profile.editableFields} initial={{ preferredName: profile.preferredName, phone: profile.personal?.phone ?? null, headline: profile.headline }} />}
        />
        <dl className="divide-y divide-line/60">
          <InfoRow icon={UserRound} label="Nome completo" value={profile.name} />
          <InfoRow icon={Mail} label="E-mail" value={profile.email} />
          <InfoRow icon={Briefcase} label="Cargo" value={profile.position ?? "—"} />
          <InfoRow icon={Network} label="Área" value={profile.orgUnit ?? "—"} />
          <InfoRow icon={MapPin} label="Localização" value={formatLocation(profile.city, profile.state)} />
          <InfoRow icon={CalendarDays} label="Data de entrada" value={formatDate(profile.hireDate)} />
          <InfoRow icon={UsersRound} label="Gestor(a)" value={profile.managerName ?? "—"} />
        </dl>
      </Card>
      <CompetencyBarsCard development={development} href={"/desenvolvimento?aba=competencias" as Route} />
    </div>
  );
}

function MyData({ profile }: { profile: Profile }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          title="Dados pessoais"
          description="Visíveis para você e para o time de Gente & Gestão."
          action={<EditProfileDialog editable={profile.editableFields} initial={{ preferredName: profile.preferredName, phone: profile.personal?.phone ?? null, headline: profile.headline }} />}
        />
        <dl className="divide-y divide-line/60">
          <InfoRow icon={UserRound} label="Nome social/preferido" value={profile.preferredName ?? "—"} />
          <InfoRow icon={Phone} label="Telefone" value={profile.personal?.phone ?? "—"} />
        </dl>
      </Card>
      <Card>
        <CardHeader title="Vínculo" description="Mantidos pelo time de Gente & Gestão." />
        <dl className="divide-y divide-line/60">
          <InfoRow icon={Hash} label="Matrícula" value={profile.personal?.employeeCode ?? "—"} />
          <InfoRow icon={FileBadge} label="Tipo de contrato" value={CONTRACT_LABELS[profile.personal?.contractType ?? ""] ?? "—"} />
          <InfoRow icon={CalendarDays} label="Data de entrada" value={formatDate(profile.hireDate)} />
          <InfoRow icon={Briefcase} label="Nível" value={profile.level ?? "—"} />
        </dl>
      </Card>
      <Card>
        <CardHeader title="Segurança" description="Troque sua senha sempre que achar necessário." />
        <ChangePasswordForm />
      </Card>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando perfil">
      <div className="mb-6 flex items-center gap-6 rounded-xl bg-purple-50 p-8">
        <Skeleton className="size-36 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-5 w-1/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
      </div>
      <div className="card space-y-4 p-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}
