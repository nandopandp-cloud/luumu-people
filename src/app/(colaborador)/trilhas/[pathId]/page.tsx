import { Award, CircleCheck, Clock3, Layers, ListChecks } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { CourseCover } from "@/features/courses/course-cover";
import { COURSE_KIND_LABEL, formatMinutes } from "@/features/courses/labels";
import { StartCourseButton } from "@/features/courses/start-course-button";
import { PATH_STATUS } from "@/features/paths/labels";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getPath, type PathCourse } from "@/server/modules/learning/service";

export const metadata: Metadata = { title: "Trilha" };

export default function PathPage({ params }: PageProps<"/trilhas/[pathId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
      <PathDetail params={params} />
    </Suspense>
  );
}

async function PathDetail({ params }: { params: PageProps<"/trilhas/[pathId]">["params"] }) {
  const actor = await requireActor();
  const { pathId } = await params;
  if (!z.uuid().safeParse(pathId).success) notFound();
  let data: Awaited<ReturnType<typeof getPath>>;
  try {
    data = await getPath(actor, pathId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const { path, courses, completedCount, totalMinutes, progress, status, nextCourseId } = data;
  const statusLabel = PATH_STATUS[status];

  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Trilhas", href: "/trilhas" }, { label: path.title }]} />
      </div>
      <section className="card mb-6 overflow-hidden">
        <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
          <CourseCover coverFileId={null} theme={path.theme} illustration={path.illustration} className="h-48 w-full md:h-full" iconClassName="size-20" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">Trilha</Badge>
              {path.category ? <Badge tone="purple">{path.category}</Badge> : null}
              <Badge tone={statusLabel.tone}>{statusLabel.label}</Badge>
            </div>
            <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{path.title}</h1>
            {path.description ? <p className="mt-2 max-w-2xl text-body text-neutral-600">{path.description}</p> : null}
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-neutral-600">
              <li className="flex items-center gap-1.5">
                <Layers aria-hidden className="size-4" /> {courses.length} {courses.length === 1 ? "curso" : "cursos"}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock3 aria-hidden className="size-4" /> {formatMinutes(totalMinutes)}
              </li>
            </ul>
            <div className="mt-5 max-w-md">
              <Progress value={progress} label="Seu progresso na trilha" tone={status === "completed" ? "green" : "purple"} />
              <p className="mt-1 text-caption text-neutral-500">
                {completedCount} de {courses.length} {courses.length === 1 ? "curso concluído" : "cursos concluídos"}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {status === "completed" ? (
                <p className="flex items-center gap-2 text-body font-semibold text-green-700">
                  <Award aria-hidden className="size-5" /> Trilha concluída. Parabéns!
                </p>
              ) : nextCourseId ? (
                <StartCourseButton courseId={nextCourseId} label={status === "in_progress" ? "Continuar trilha" : "Começar trilha"} size="lg" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <h2 className="mb-4 text-h3 font-bold text-neutral-900">Cursos da trilha</h2>
        {courses.length === 0 ? (
          <EmptyState compact title="Esta trilha ainda não tem cursos disponíveis" description="Os cursos aparecem aqui assim que forem publicados." />
        ) : (
          <ol className="space-y-3">
            {courses.map((c, index) => (
              <li key={c.id}>
                <CourseStep course={c} step={index + 1} isNext={c.id === nextCourseId && status !== "completed"} />
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function CourseStep({ course: c, step, isNext }: { course: PathCourse; step: number; isNext: boolean }) {
  const done = c.status === "completed";
  return (
    <article className={cn("flex flex-col gap-4 rounded-xl border border-line p-3 sm:flex-row sm:items-center", isNext && "border-purple-200 bg-purple-50/60")}>
      <div className="flex items-center gap-3 sm:contents">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-body-sm font-bold",
            done ? "bg-green-100 text-green-700" : isNext ? "bg-purple-500 text-white" : "bg-neutral-100 text-neutral-600",
          )}
        >
          {done ? <CircleCheck aria-label={`Etapa ${step} concluída`} className="size-5" /> : <span aria-label={`Etapa ${step}`}>{step}</span>}
        </span>
        <CourseCover coverFileId={c.coverFileId} theme={c.theme} illustration={c.illustration} className="h-16 w-24 shrink-0 rounded-lg" iconClassName="size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-[15px] font-semibold leading-snug text-neutral-900">
            <Link href={`/meus-cursos/${c.id}` as Route} className="hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
              {c.title}
            </Link>
          </h3>
          {c.mandatory ? <Badge tone="red">Obrigatório</Badge> : null}
          {isNext ? <Badge tone="purple">Próximo</Badge> : null}
        </div>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-caption text-neutral-500">
          <span>{COURSE_KIND_LABEL[c.kind]}</span>
          <span className="flex items-center gap-1">
            <ListChecks aria-hidden className="size-3.5" /> {c.lessonsTotal} {c.lessonsTotal === 1 ? "aula" : "aulas"}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 aria-hidden className="size-3.5" /> {formatMinutes(c.minutes)}
          </span>
        </p>
        {c.status !== "available" ? <Progress value={c.progress} label={`Progresso em ${c.title}`} tone={done ? "green" : "purple"} className="mt-2 max-w-sm" /> : null}
      </div>
      <div className="shrink-0">
        {done ? (
          <span className="flex items-center gap-1.5 text-body-sm font-medium text-green-700">
            <CircleCheck aria-hidden className="size-4" /> Concluído
          </span>
        ) : (
          <StartCourseButton courseId={c.id} label={c.status === "in_progress" ? "Continuar" : "Começar"} variant={isNext ? "primary" : "soft"} />
        )}
      </div>
    </article>
  );
}
