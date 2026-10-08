import { AlarmClock, ArrowRight, ChevronRight, ClipboardList, FileText, Headphones, ListChecks, PlayCircle, SquareCheckBig, SquarePen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { CircularProgress, Progress } from "@/design-system/components/progress";
import { EmptyState } from "@/design-system/components/empty-state";
import { cn } from "@/design-system/cn";
import { CoverArt } from "@/design-system/illustrations/cover-art";
import { HexBadge } from "@/design-system/illustrations/hex-badge";
import { JourneySignpost } from "@/design-system/illustrations/journey-signpost";
import { formatDate } from "@/lib/format";
import type { AuthenticatedActor } from "@/server/auth/session";
import { achievementsEnabled } from "@/server/dal";
import { listMyAchievements } from "@/server/modules/achievements/service";
import { listAnnouncementFeed } from "@/server/modules/announcements/service";
import { listLiveBanners } from "@/server/modules/banners/service";
import { getMyLearningProgress, listNextActivities, listRecommendedPaths, type NextActivity } from "@/server/modules/learning/service";
import { listFeaturedLibrary } from "@/server/modules/library/service";
import { getMyProfile } from "@/server/modules/people/service";
import { MOODS } from "@/server/modules/wellbeing/schemas";
import { getTodayMood } from "@/server/modules/wellbeing/service";
import { HeroCarousel } from "./hero-banner";
import { ANNOUNCEMENT_CATEGORY, daysUntil, formatMinutes, LIBRARY_TYPE, relativeDay } from "./labels";
import { MoodCheckin } from "./mood-checkin";

/* ---------------------------------------------------------------- blocos */

export function SectionHeader({ id, title, href, linkLabel = "Ver todos" }: { id: string; title: string; href: Route; linkLabel?: string }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-4">
      <h2 id={id} className="text-[19px] font-bold tracking-[-0.01em] text-neutral-900">
        {title}
      </h2>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-full text-body-sm font-medium text-purple-600 hover:text-purple-700 hover:underline underline-offset-4">
        {linkLabel} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-line bg-white p-5 shadow-sm", className)}>{children}</section>;
}

function RoundArrow({ label }: { label: string }) {
  return (
    <span aria-hidden title={label} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-neutral-800 shadow-sm transition-colors group-hover:border-purple-200 group-hover:bg-purple-50 group-hover:text-purple-600">
      <ArrowRight className="size-4" />
    </span>
  );
}

/* ------------------------------------------------------------------ hero */

export async function HomeHero({ actor }: { actor: AuthenticatedActor }) {
  const [profile, banners] = await Promise.all([getMyProfile(actor), listLiveBanners(actor)]);
  const firstName = (profile.preferredName || profile.name).split(" ")[0];
  if (banners.length > 0) {
    return (
      <>
        <h1 className="sr-only">Início</h1>
        <HeroCarousel greeting={`Olá, ${firstName}!`} slides={banners.map(({ id, title, subtitle, ctaLabel, ctaUrl, theme, illustration, imageFileId }) => ({ id, title, subtitle, ctaLabel, ctaUrl, theme, illustration, imageFileId }))} />
      </>
    );
  }
  // Sem banner ativo: boas-vindas padrão.
  return (
    <section aria-label="Boas-vindas" className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#efe8fe] via-[#e3d8fb] to-[#d3c2f7]">
      <svg aria-hidden viewBox="0 0 800 320" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M380 0c60 90 30 160 120 210s190 20 300 110V0Z" fill="#ffffff" opacity="0.22" />
        <path d="M520 320c40-80 130-120 280-120v120Z" fill="#c9b5f5" opacity="0.5" />
      </svg>
      <div className="relative grid items-end md:grid-cols-[minmax(0,1.12fr)_minmax(260px,0.88fr)]">
        <div className="px-7 py-8 sm:px-9 sm:py-8">
          <p className="text-[17px] font-semibold text-neutral-800">
            Olá, {firstName}! <span aria-hidden>👋</span>
          </p>
          <h1 className="mt-3 max-w-[26rem] text-[2rem] font-extrabold leading-[1.08] tracking-[-0.035em] text-neutral-900 sm:text-[2.2rem]">
            Pessoas que aprendem hoje constroem o amanhã.
          </h1>
          <p className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-neutral-700">Explore conteúdos, desenvolva suas habilidades e faça parte de uma cultura que cresce junta.</p>
          <Button asChild size="lg" className="mt-6 h-11 px-7">
            <Link href="/meus-cursos">
              Explorar cursos <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <JourneySignpost className="hidden h-full max-h-[300px] w-full self-end md:block" />
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- comunicados */

export async function AnnouncementsSection({ actor }: { actor: AuthenticatedActor }) {
  const items = await listAnnouncementFeed(actor, 3);
  return (
    <section aria-labelledby="comunicados">
      <SectionHeader id="comunicados" title="Comunicados para você" href="/comunicados" />
      {items.length === 0 ? (
        <Panel>
          <EmptyState compact title="Nenhum comunicado por enquanto" description="Quando houver novidades para você, elas aparecem aqui." />
        </Panel>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {items.map((a) => {
            const category = ANNOUNCEMENT_CATEGORY[a.category] ?? { label: a.category, tone: "purple" as const };
            return (
              <li key={a.id}>
                <Link href={`/comunicados/${a.id}` as Route} className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-purple-500">
                  <CoverArt theme={a.theme} illustration={a.illustration} className="h-[86px] shrink-0" />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={category.tone}>{category.label}</Badge>
                      <time className="text-caption text-neutral-500" dateTime={a.publishedAt?.toISOString()}>
                        {relativeDay(a.publishedAt)}
                      </time>
                    </div>
                    <h3 className="mt-3 text-[15px] font-semibold leading-snug text-neutral-900 group-hover:text-purple-600">{a.title}</h3>
                    <div className="mt-1 flex flex-1 items-end justify-between gap-3">
                      <p className="line-clamp-2 text-body-sm text-neutral-600">{a.summary}</p>
                      <RoundArrow label="Ler comunicado" />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- trilhas */

export async function RecommendedPathsSection({ actor }: { actor: AuthenticatedActor }) {
  const paths = await listRecommendedPaths(actor, 3);
  return (
    <section aria-labelledby="trilhas-recomendadas">
      <SectionHeader id="trilhas-recomendadas" title="Trilhas recomendadas para você" href="/trilhas" linkLabel="Ver todas" />
      {paths.length === 0 ? (
        <Panel>
          <EmptyState compact title="Você concluiu todas as trilhas disponíveis 🎉" description="Novas trilhas aparecem aqui assim que forem publicadas." />
        </Panel>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {paths.map((p) => (
            <li key={p.id}>
              <Link href={`/trilhas/${p.id}` as Route} className="group flex h-full gap-3.5 rounded-xl border border-line bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-purple-500">
                <CoverArt theme={p.theme} illustration={p.illustration} className="h-[112px] w-[92px] shrink-0 rounded-lg" iconClassName="size-10" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone="purple">Trilha</Badge>
                    <RoundArrow label="Ver trilha" />
                  </div>
                  <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900 group-hover:text-purple-600">{p.title}</h3>
                  <p className="mt-1 text-caption text-neutral-500">
                    {p.courseCount} {p.courseCount === 1 ? "curso" : "cursos"} · {formatMinutes(p.totalMinutes)}
                  </p>
                  <Progress value={p.progress} label={`Progresso na trilha ${p.title}`} className="mt-auto pt-2" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- conteúdos */

const LIBRARY_ICONS: Record<string, LucideIcon> = { video: PlayCircle, article: FileText, podcast: Headphones, quiz: SquareCheckBig, pdf: FileText, template: ClipboardList, checklist: ListChecks };

export async function FeaturedContentSection({ actor }: { actor: AuthenticatedActor }) {
  const items = await listFeaturedLibrary(actor, 4);
  return (
    <section aria-labelledby="conteudos-destaque">
      <SectionHeader id="conteudos-destaque" title="Conteúdos em destaque" href="/biblioteca" linkLabel="Ver todos" />
      {items.length === 0 ? (
        <Panel>
          <EmptyState compact title="A biblioteca ainda está vazia" description="Vídeos, artigos e podcasts em destaque aparecem aqui." />
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const meta = LIBRARY_TYPE[item.type] ?? LIBRARY_TYPE.article!;
            const Icon = LIBRARY_ICONS[item.type] ?? FileText;
            return (
              <li key={item.id}>
                <Link href="/biblioteca" className={cn("group flex h-full items-start gap-3 rounded-lg p-3.5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-purple-500", meta.card)}>
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-md bg-white/80 shadow-sm", meta.iconBox)}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-[11px] font-semibold uppercase tracking-wide", meta.overline)}>
                      {meta.label}
                      {item.durationMinutes ? <span className="font-medium normal-case"> · {formatMinutes(item.durationMinutes)}</span> : null}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-body-sm font-semibold leading-snug text-neutral-900">{item.title}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------------------------------- coluna lateral */

function AsideHeader({ id, title, href, linkLabel }: { id: string; title: string; href: Route; linkLabel: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 id={id} className="text-[17px] font-bold tracking-[-0.01em] text-neutral-900">
        {title}
      </h2>
      <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
        {linkLabel} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

export async function MyProgressCard({ actor }: { actor: AuthenticatedActor }) {
  const progress = await getMyLearningProgress(actor);
  return (
    <Panel>
      <AsideHeader id="meu-progresso" title="Meu progresso" href="/meus-cursos" linkLabel="Ver tudo" />
      {progress.enrolled === 0 ? (
        <p className="text-body-sm text-neutral-600">Você ainda não começou nenhum curso. Que tal explorar o catálogo?</p>
      ) : (
        <div className="flex items-center gap-5">
          <CircularProgress value={progress.percent} label="Progresso geral nos cursos" size={104} stroke={11} />
          <div>
            <p className="text-[26px] font-bold leading-none tracking-[-0.02em] text-neutral-900">
              {progress.completed} de {progress.enrolled}
            </p>
            <p className="mt-1.5 text-body-sm text-neutral-700">
              cursos concluídos <span aria-hidden>🎉</span>
            </p>
          </div>
        </div>
      )}
    </Panel>
  );
}

const ACTIVITY: Record<NextActivity["kind"], { icon: LucideIcon; verb: (p: number) => string }> = {
  course: { icon: SquarePen, verb: (p) => (p > 0 ? "Finalizar curso" : "Iniciar curso") },
  video: { icon: PlayCircle, verb: () => "Assistir vídeo" },
  quiz: { icon: ListChecks, verb: () => "Realizar quiz" },
};

export async function NextActivitiesCard({ actor }: { actor: AuthenticatedActor }) {
  const items = await listNextActivities(actor, 4);
  return (
    <Panel>
      <AsideHeader id="proximas-atividades" title="Minhas próximas atividades" href="/meus-cursos" linkLabel="Ver agenda" />
      {items.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nada pendente por aqui. Aproveite para explorar novas trilhas!</p>
      ) : (
        <ul className="-my-1 divide-y divide-line">
          {items.map((a) => {
            const meta = ACTIVITY[a.kind];
            const due = a.dueDate ? daysUntil(a.dueDate) : null;
            const urgent = due !== null && due <= 3;
            return (
              <li key={a.enrollmentId}>
                <Link href="/meus-cursos" className="group flex items-center gap-3.5 py-3.5 focus-visible:outline-2 focus-visible:outline-purple-500">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                    <meta.icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption text-neutral-500">{meta.verb(a.progress)}</span>
                    <span className="block truncate text-body-sm font-semibold text-neutral-900 group-hover:text-purple-600">{a.courseTitle}</span>
                    {urgent ? (
                      <span className="mt-0.5 flex items-center gap-1 text-caption font-medium text-red-600">
                        <AlarmClock aria-hidden className="size-3.5" />
                        {due! < 0 ? "Prazo vencido" : due === 0 ? "Encerra hoje" : `Encerra em ${due} ${due === 1 ? "dia" : "dias"}`}
                      </span>
                    ) : (
                      <span className="block truncate text-caption text-neutral-500">{a.pathTitle ? `Trilha ${a.pathTitle}` : a.mandatory ? "Treinamento obrigatório" : "Curso livre"}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-caption text-neutral-500">{formatMinutes(a.remainingMinutes)}</span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export async function MoodCard({ actor }: { actor: AuthenticatedActor }) {
  const today = await getTodayMood(actor);
  return (
    <section aria-labelledby="humor" className="rounded-xl bg-gradient-to-br from-[#fdeef4] to-[#fbe3ee] p-5">
      <h2 id="humor" className="mb-4 text-[17px] font-bold tracking-[-0.01em] text-neutral-900">
        Como você está se sentindo hoje?
      </h2>
      <MoodCheckin moods={MOODS} initial={today} />
    </section>
  );
}

export async function AchievementsCard({ actor }: { actor: AuthenticatedActor }) {
  if (!(await achievementsEnabled())) return null;
  const items = await listMyAchievements(actor, 4);
  return (
    <Panel>
      <AsideHeader id="minhas-conquistas" title="Minhas conquistas" href="/minhas-conquistas" linkLabel="Ver todas" />
      {items.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Conclua seu primeiro curso para desbloquear a primeira conquista.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col items-center text-center">
              <HexBadge icon={a.icon} theme={a.theme} />
              <span className="mt-2 text-[12px] font-medium leading-tight text-neutral-800">{a.name}</span>
              <span className="mt-0.5 text-[11px] text-neutral-500">{formatDate(a.earnedAt.toISOString())}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
