import { AlarmClock, ArrowRight, Bell, BookOpen, ChevronRight, CircleCheck, Clock3, ListChecks, PlayCircle, Search, SquarePen, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { ColumnChart } from "@/design-system/components/charts";
import { EmptyState } from "@/design-system/components/empty-state";
import { CircularProgress, Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { HexBadge } from "@/design-system/illustrations/hex-badge";
import { daysUntil } from "@/features/home/labels";
import { formatDate } from "@/lib/format";
import type { AuthenticatedActor } from "@/server/auth/session";
import { achievementsEnabled } from "@/server/dal";
import { listMyAchievements } from "@/server/modules/achievements/service";
import {
  learningHoursByMonth,
  listCatalog,
  listMyCourses,
  listRecommendedCourses,
  listReminders,
  type CatalogFilter,
  type MyCourse,
  type MyCourseTab,
} from "@/server/modules/courses/service";
import { getMyLearningProgress, listRecommendedPaths } from "@/server/modules/learning/service";
import { CourseCover } from "./course-cover";
import { formatMinutes, monthLabel } from "./labels";
import { StartCourseButton } from "./start-course-button";

const TAB_TITLES: Record<MyCourseTab, string> = {
  "em-andamento": "Em andamento",
  "nao-iniciados": "Não iniciados",
  concluidos: "Concluídos",
  obrigatorios: "Obrigatórios",
};

function SectionTitle({ id, children, href, linkLabel }: { id: string; children: React.ReactNode; href?: Route; linkLabel?: string }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-4">
      <h2 id={id} className="text-[19px] font-bold tracking-[-0.01em] text-neutral-900">
        {children}
      </h2>
      {href ? (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
          {linkLabel} <ArrowRight aria-hidden className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

function MandatoryBadge({ mandatory }: { mandatory: boolean }) {
  return mandatory ? (
    <Badge tone="red" className="bg-white/95 shadow-sm">
      <AlarmClock aria-hidden /> Obrigatório
    </Badge>
  ) : (
    <Badge tone="blue" className="bg-white/95 shadow-sm">
      Opcional
    </Badge>
  );
}

/* ---------------------------------------------------------- meus cursos */

export async function MyCoursesSection({ actor, tab }: { actor: AuthenticatedActor; tab: MyCourseTab }) {
  const { items } = await listMyCourses(actor, tab);
  return (
    <section aria-labelledby="meus-cursos-lista">
      <SectionTitle id="meus-cursos-lista">
        {TAB_TITLES[tab]} <span className="font-semibold text-neutral-600">({items.length})</span>
      </SectionTitle>
      {items.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            compact
            title={tab === "concluidos" ? "Você ainda não concluiu nenhum curso" : tab === "obrigatorios" ? "Nenhum treinamento obrigatório para você" : "Nada por aqui no momento"}
            description="Explore o catálogo abaixo e comece um novo aprendizado quando quiser."
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((c) => (
            <li key={c.courseId}>
              <CourseCard course={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CourseCard({ course: c }: { course: MyCourse }) {
  const cta = c.status === "completed" ? "Revisar" : c.status === "in_progress" ? "Continuar" : "Começar";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <CourseCover coverFileId={c.coverFileId} theme={c.theme} illustration={c.illustration} className="h-[104px] w-full" />
        <div className="absolute right-3 top-3">
          <MandatoryBadge mandatory={c.mandatory} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
          <Link href={`/meus-cursos/${c.courseId}` as Route} className="hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
            {c.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-caption text-neutral-500">{c.pathTitle ? `Trilha ${c.pathTitle}` : (c.category ?? "Curso livre")}</p>
        <Progress value={c.progress} label={`Progresso em ${c.title}`} className="mt-3" />
        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-2 whitespace-nowrap pt-3 text-[11.5px] text-neutral-500">
          <span className="flex items-center gap-1">
            <ListChecks aria-hidden className="size-3.5" /> {c.lessonsDone} de {c.lessonsTotal} aulas
          </span>
          {c.status !== "completed" ? (
            <span className="flex items-center gap-1">
              <Clock3 aria-hidden className="size-3.5" /> {formatMinutes(c.remainingMinutes)}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-green-700">
              <CircleCheck aria-hidden className="size-3.5" /> Concluído
            </span>
          )}
          <span className="ml-auto">
            <StartCourseButton courseId={c.courseId} label={cta} variant={c.status === "in_progress" ? "primary" : "soft"} />
          </span>
        </div>
      </div>
    </article>
  );
}

/* --------------------------------------------------------- recomendados */

export async function RecommendedSection({ actor }: { actor: AuthenticatedActor }) {
  const [paths, courses] = await Promise.all([listRecommendedPaths(actor, 2), listRecommendedCourses(actor, 1)]);
  const items = [
    ...paths.map((p) => ({ key: `p-${p.id}`, kind: "Trilha" as const, title: p.title, description: p.category ? `Desenvolva ${p.category.toLowerCase()} na prática.` : "Uma jornada completa de aprendizado.", meta: `${p.courseCount} cursos · ${formatMinutes(p.totalMinutes)}`, href: `/trilhas/${p.id}` as Route, cta: "Ver trilha", theme: p.theme, illustration: p.illustration, coverFileId: null })),
    ...courses.map((c) => ({ key: `c-${c.id}`, kind: "Curso" as const, title: c.title, description: c.category ?? "Aprenda no seu ritmo, quando quiser.", meta: `${c.lessons} aulas · ${formatMinutes(c.minutes)}`, href: `/meus-cursos/${c.id}` as Route, cta: "Ver curso", theme: c.theme, illustration: c.illustration, coverFileId: c.coverFileId })),
  ];
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recomendados">
      <SectionTitle id="recomendados" href={"/trilhas" as Route} linkLabel="Ver mais">
        Recomendados para você
      </SectionTitle>
      <ul className="grid gap-4 md:grid-cols-3">
        {items.map((i) => (
          <li key={i.key}>
            <article className="flex h-full gap-3.5 rounded-xl border border-line bg-white p-3 shadow-sm">
              <CourseCover coverFileId={i.coverFileId} theme={i.theme} illustration={i.illustration} className="h-[150px] w-[104px] shrink-0 rounded-lg" iconClassName="size-10" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Badge tone="purple" className="self-start">
                  {i.kind}
                </Badge>
                <h3 className="mt-1.5 line-clamp-2 hyphens-auto break-words text-[15px] font-semibold leading-snug text-neutral-900">{i.title}</h3>
                <p className="mt-1 line-clamp-2 text-caption text-neutral-600">{i.description}</p>
                <p className="mt-1 text-caption text-neutral-500">{i.meta}</p>
                <Button asChild variant="soft" size="sm" className="mt-auto self-stretch">
                  <Link href={i.href}>
                    {i.cta} <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------- catálogo */

const CATALOG_FILTERS: { value: CatalogFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "trilhas", label: "Trilhas" },
  { value: "cursos", label: "Cursos" },
  { value: "obrigatorios", label: "Obrigatórios" },
];

export async function CatalogSection({ actor, filter, query, tab, limit }: { actor: AuthenticatedActor; filter: CatalogFilter; query?: string; tab: MyCourseTab; limit: number }) {
  const all = await listCatalog(actor, filter, query);
  const items = all.slice(0, limit);
  const href = (f: CatalogFilter) => ({ pathname: "/meus-cursos", query: { ...(tab !== "em-andamento" && { aba: tab }), ...(f !== "todos" && { catalogo: f }), ...(query && { q: query }) } });
  return (
    <section aria-labelledby="catalogo" className="scroll-mt-6" id="catalogo-secao">
      <SectionTitle id="catalogo">Catálogo de cursos</SectionTitle>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Filtrar catálogo">
          <ul className="flex flex-wrap gap-1.5">
            {CATALOG_FILTERS.map((f) => (
              <li key={f.value}>
                <Link
                  href={href(f.value)}
                  aria-current={f.value === filter ? "page" : undefined}
                  scroll={false}
                  className={cn("inline-flex h-9 items-center rounded-full px-4 text-body-sm font-medium", f.value === filter ? "bg-purple-500 text-white" : "bg-white text-neutral-600 ring-1 ring-line hover:bg-purple-50 hover:text-purple-600")}
                >
                  {f.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form role="search" className="relative ml-auto w-full max-w-xs" action="/meus-cursos">
          {tab !== "em-andamento" ? <input type="hidden" name="aba" value={tab} /> : null}
          {filter !== "todos" ? <input type="hidden" name="catalogo" value={filter} /> : null}
          <label htmlFor="catalog-q" className="sr-only">
            Buscar no catálogo
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
          <input id="catalog-q" name="q" type="search" defaultValue={query} placeholder="Buscar no catálogo…" className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-4 text-body-sm placeholder:text-neutral-500 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100" />
        </form>
      </div>
      {items.length === 0 ? (
        <div className="card p-6">
          <EmptyState compact title="Nenhum resultado encontrado" description="Tente ajustar os filtros ou buscar por outro termo." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((i) => {
            const href = (i.kind === "path" ? `/trilhas/${i.id}` : `/meus-cursos/${i.id}`) as Route;
            return (
              <li key={`${i.kind}-${i.id}`}>
                <article className="flex h-full gap-3.5 rounded-xl border border-line bg-white p-3 shadow-sm">
                  <CourseCover coverFileId={i.coverFileId} theme={i.theme} illustration={i.illustration} className="h-[112px] w-[104px] shrink-0 rounded-lg" iconClassName="size-10" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={i.kind === "path" ? "green" : "purple"}>{i.kind === "path" ? "Trilha" : "Curso"}</Badge>
                      {i.mandatory ? <Badge tone="red">Obrigatório</Badge> : null}
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 hyphens-auto break-words text-[15px] font-semibold leading-snug text-neutral-900">
                      <Link href={href} className="hover:text-purple-600">
                        {i.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 text-caption text-neutral-500">
                      {i.count} {i.kind === "path" ? (i.count === 1 ? "curso" : "cursos") : i.count === 1 ? "aula" : "aulas"} · {formatMinutes(i.minutes)}
                    </p>
                    <div className="mt-auto pt-2">
                      {i.kind === "path" ? (
                        <Button asChild variant="soft" size="sm" block>
                          <Link href={href}>Ver trilha</Link>
                        </Button>
                      ) : i.myStatus === "completed" ? (
                        <Button asChild variant="soft" size="sm" block>
                          <Link href={href}>
                            <CircleCheck aria-hidden /> Concluído
                          </Link>
                        </Button>
                      ) : (
                        <div className="[&>button]:w-full">
                          <StartCourseButton courseId={i.id} label={i.myStatus === "in_progress" ? "Continuar" : "Iniciar"} variant="primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > items.length ? (
        <div className="mt-4 text-center">
          <Button asChild variant="secondary">
            <Link href={{ pathname: "/meus-cursos", query: { ...href(filter).query, mais: String(limit + 6) }, hash: "catalogo-secao" }} scroll={false}>
              Ver mais ({all.length - items.length})
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------- coluna lateral */

function AsideCard({ id, title, icon: Icon, href, linkLabel, children, className }: { id: string; title: string; icon?: LucideIcon; href?: Route; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("rounded-xl border border-line bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.01em] text-neutral-900">
          {Icon ? <Icon aria-hidden className="size-5 text-purple-500" /> : null}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
            {linkLabel} <ArrowRight aria-hidden className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export async function OverallProgressCard({ actor }: { actor: AuthenticatedActor }) {
  const p = await getMyLearningProgress(actor);
  return (
    <AsideCard id="progresso-geral" title="Meu progresso geral" href={"/meus-cursos?aba=concluidos" as Route} linkLabel="Ver histórico">
      <div className="flex items-center gap-5">
        <CircularProgress value={p.percent} label="Progresso geral nos cursos" size={104} stroke={11} />
        <div>
          <p className="text-[26px] font-bold leading-none tracking-[-0.02em] text-neutral-900">
            {p.completed} de {p.enrolled}
          </p>
          <p className="mt-1.5 text-body-sm text-neutral-700">
            cursos concluídos <span aria-hidden>🎉</span>
          </p>
          <p className="mt-2 text-caption text-neutral-600">{p.enrolled === 0 ? "Comece pelo catálogo abaixo." : "Continue assim! Você está evoluindo muito bem."}</p>
        </div>
      </div>
    </AsideCard>
  );
}

const REMINDER_ICON: Record<string, LucideIcon> = { course: SquarePen, video: PlayCircle, quiz: ListChecks };

export async function RemindersCard({ actor }: { actor: AuthenticatedActor }) {
  const items = await listReminders(actor);
  return (
    <AsideCard id="lembretes" title="Lembretes e pendências" icon={Bell} href={"/meus-cursos?aba=obrigatorios" as Route} linkLabel="Ver todos" className="bg-gradient-to-b from-purple-50/80 to-white">
      {items.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nenhum prazo nos próximos 14 dias. 🎈</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((r) => {
            const Icon = REMINDER_ICON[r.kind] ?? BookOpen;
            const due = daysUntil(r.dueDate);
            const verb = r.status === "in_progress" ? "Finalizar curso" : r.kind === "quiz" ? "Realizar quiz" : r.kind === "video" ? "Assistir vídeo" : "Iniciar treinamento";
            return (
              <li key={r.courseId}>
                <Link href={`/meus-cursos/${r.courseId}` as Route} className="group flex items-center gap-3 rounded-lg border border-line bg-white p-3 hover:border-purple-200">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-caption text-neutral-500">{verb}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-body-sm font-semibold text-neutral-900 group-hover:text-purple-600">{r.title}</span>
                      {r.mandatory ? <Badge tone="red">Obrigatório</Badge> : null}
                    </span>
                    <span className={cn("mt-0.5 flex items-center gap-1 text-caption font-medium", due <= 3 ? "text-red-600" : "text-neutral-600")}>
                      <AlarmClock aria-hidden className="size-3.5" />
                      {due < 0 ? "Prazo vencido" : due === 0 ? "Prazo: hoje" : `Prazo: ${due} ${due === 1 ? "dia" : "dias"}`}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AsideCard>
  );
}

export async function AchievementsMiniCard({ actor }: { actor: AuthenticatedActor }) {
  if (!(await achievementsEnabled())) return null;
  const items = await listMyAchievements(actor, 4);
  return (
    <AsideCard id="conquistas-cursos" title="Minhas conquistas" href={"/minhas-conquistas" as Route} linkLabel="Ver todas" className="bg-gradient-to-b from-green-50/70 to-white">
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
    </AsideCard>
  );
}

export async function EvolutionCard({ actor }: { actor: AuthenticatedActor }) {
  const months = await learningHoursByMonth(actor, 6);
  const current = months.at(-1)?.minutes ?? 0;
  const previous = months.at(-2)?.minutes ?? 0;
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  const hours = (m: number) => Math.round((m / 60) * 10) / 10;
  return (
    <AsideCard id="evolucao" title="Minha evolução" icon={TrendingUp} className="bg-gradient-to-b from-orange-50/60 to-white">
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-body-sm text-neutral-600">Horas de aprendizado</p>
        <div className="text-right">
          <p className="text-[24px] font-bold leading-none text-neutral-900">{hours(current).toLocaleString("pt-BR")}h</p>
          <p className="text-caption text-neutral-600">este mês</p>
          {delta !== null ? (
            <Badge tone={delta >= 0 ? "green" : "orange"} className="mt-1.5">
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%<span className="sr-only"> em relação ao mês anterior</span>
            </Badge>
          ) : null}
        </div>
      </div>
      <ColumnChart title="Horas por mês" valueSuffix="h" height={170} data={months.map((m) => ({ label: monthLabel(m.month), value: hours(m.minutes) }))} />
    </AsideCard>
  );
}

