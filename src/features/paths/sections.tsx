import { ArrowRight, CircleCheck, Clock3, Layers, Star } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Progress } from "@/design-system/components/progress";
import { CourseCover } from "@/features/courses/course-cover";
import { formatMinutes } from "@/features/courses/labels";
import { StartCourseButton } from "@/features/courses/start-course-button";
import type { AuthenticatedActor } from "@/server/auth/session";
import { listPaths, type PathSummary, type PathTab } from "@/server/modules/learning/service";
import { PATH_STATUS } from "./labels";

const TAB_TITLES: Record<PathTab, string> = {
  todas: "Todas as trilhas",
  "em-andamento": "Em andamento",
  "nao-iniciadas": "Não iniciadas",
  concluidas: "Concluídas",
};

const EMPTY: Record<PathTab, { title: string; description: string }> = {
  todas: { title: "Nenhuma trilha publicada ainda", description: "Assim que a sua empresa publicar trilhas de aprendizagem, elas aparecem aqui." },
  "em-andamento": { title: "Nenhuma trilha em andamento", description: "Escolha uma trilha em “Todas” e comece pelo primeiro curso." },
  "nao-iniciadas": { title: "Você já começou todas as trilhas", description: "Continue de onde parou em “Em andamento”." },
  concluidas: { title: "Você ainda não concluiu nenhuma trilha", description: "Cada curso concluído te aproxima da primeira. Continue assim!" },
};

export async function PathsSection({ actor, tab }: { actor: AuthenticatedActor; tab: PathTab }) {
  const { items } = await listPaths(actor, tab);
  return (
    <section aria-labelledby="trilhas-lista">
      <h2 id="trilhas-lista" className="mb-3.5 text-[19px] font-bold tracking-[-0.01em] text-neutral-900">
        {TAB_TITLES[tab]} <span className="font-semibold text-neutral-600">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            compact
            {...EMPTY[tab]}
            action={
              tab === "todas" ? undefined : (
                <Button asChild variant="soft">
                  <Link href="/trilhas">Ver todas as trilhas</Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <PathCard path={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PathCard({ path: p }: { path: PathSummary }) {
  const href = `/trilhas/${p.id}` as Route;
  const status = PATH_STATUS[p.status];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <CourseCover coverFileId={null} theme={p.theme} illustration={p.illustration} className="h-[112px] w-full" iconClassName="size-12" />
        {p.featured ? (
          <Badge tone="yellow" className="absolute right-3 top-3 bg-white/95 shadow-sm">
            <Star aria-hidden className="fill-current" /> Destaque
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          {p.category ? <Badge tone="purple">{p.category}</Badge> : null}
          <Badge tone={status.tone}>
            {p.status === "completed" ? <CircleCheck aria-hidden /> : null}
            {status.label}
          </Badge>
        </div>
        <h3 className="mt-2 text-[16px] font-semibold leading-snug text-neutral-900">
          <Link href={href} className="hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
            {p.title}
          </Link>
        </h3>
        {p.description ? <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{p.description}</p> : null}
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-neutral-500">
          <span className="flex items-center gap-1">
            <Layers aria-hidden className="size-3.5" /> {p.courseCount} {p.courseCount === 1 ? "curso" : "cursos"}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 aria-hidden className="size-3.5" /> {formatMinutes(p.totalMinutes)}
          </span>
        </p>
        <Progress value={p.progress} label={`Progresso na trilha ${p.title}`} tone={p.status === "completed" ? "green" : "purple"} className="mt-3" />
        <p className="mt-1 text-caption text-neutral-500">
          {p.completedCount} de {p.courseCount} {p.courseCount === 1 ? "curso concluído" : "cursos concluídos"}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {p.status === "in_progress" && p.nextCourseId ? <StartCourseButton courseId={p.nextCourseId} label="Continuar" /> : null}
          <Button asChild variant={p.status === "in_progress" ? "ghost" : "soft"} size="sm" className={p.status === "in_progress" ? undefined : "flex-1"}>
            <Link href={href}>
              {p.status === "completed" ? "Revisar trilha" : "Ver trilha"} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
