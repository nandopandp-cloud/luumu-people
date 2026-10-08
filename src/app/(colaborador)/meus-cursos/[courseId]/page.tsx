import { Award, BookOpen, CircleCheck, Clock3, FileText, Link2, ListChecks, PlayCircle } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { Progress } from "@/design-system/components/progress";
import { cn } from "@/design-system/cn";
import { CourseCover } from "@/features/courses/course-cover";
import { COURSE_KIND_LABEL, formatMinutes } from "@/features/courses/labels";
import { StartCourseButton } from "@/features/courses/start-course-button";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getCourse } from "@/server/modules/courses/service";

export const metadata: Metadata = { title: "Curso" };

const LESSON_ICON = { article: FileText, video: PlayCircle, pdf: BookOpen, link: Link2 } as const;

export default function CoursePage({ params }: PageProps<"/meus-cursos/[courseId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
      <Course params={params} />
    </Suspense>
  );
}

async function Course({ params }: { params: PageProps<"/meus-cursos/[courseId]">["params"] }) {
  const actor = await requireActor();
  const { courseId } = await params;
  if (!z.uuid().safeParse(courseId).success) notFound();
  let data: Awaited<ReturnType<typeof getCourse>>;
  try {
    data = await getCourse(actor, courseId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const { course, modules, lessons, enrollment, certificate, pathTitle, nextLessonId } = data;
  const done = lessons.filter((l) => l.done).length;
  const progress = enrollment?.progress ?? 0;
  const status = enrollment?.status ?? "available";

  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Meus cursos", href: "/meus-cursos" }, { label: course.title }]} />
      </div>
      <section className="card mb-6 overflow-hidden">
        <div className="grid md:grid-cols-[320px_minmax(0,1fr)]">
          <CourseCover coverFileId={course.coverFileId} theme={course.theme} illustration={course.illustration} className="h-48 w-full md:h-full" iconClassName="size-20" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <Badge tone="purple">{COURSE_KIND_LABEL[course.kind]}</Badge>
              {course.mandatory ? <Badge tone="red">Obrigatório</Badge> : <Badge tone="blue">Opcional</Badge>}
              {pathTitle ? <Badge tone="green">Trilha {pathTitle}</Badge> : null}
            </div>
            <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{course.title}</h1>
            {course.description ? <p className="mt-2 max-w-2xl text-body text-neutral-600">{course.description}</p> : null}
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-body-sm text-neutral-600">
              <li className="flex items-center gap-1.5">
                <ListChecks aria-hidden className="size-4" /> {lessons.length} {lessons.length === 1 ? "aula" : "aulas"}
              </li>
              <li className="flex items-center gap-1.5">
                <Clock3 aria-hidden className="size-4" /> {formatMinutes(course.durationMinutes)}
              </li>
              {enrollment?.dueDate ? <li>Prazo: {enrollment.dueDate.split("-").reverse().join("/")}</li> : null}
            </ul>
            <div className="mt-5 max-w-md">
              <Progress value={progress} label="Seu progresso no curso" />
              <p className="mt-1 text-caption text-neutral-500">
                {done} de {lessons.length} aulas concluídas
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {status === "completed" ? (
                <>
                  {certificate ? (
                    <Button asChild size="lg">
                      <Link href={`/certificados/${course.id}` as Route}>
                        <Award aria-hidden /> Ver certificado
                      </Link>
                    </Button>
                  ) : null}
                  <StartCourseButton courseId={course.id} label="Revisar conteúdo" variant="soft" size="lg" />
                </>
              ) : (
                <StartCourseButton courseId={course.id} label={status === "in_progress" ? "Continuar de onde parei" : "Começar curso"} size="lg" />
              )}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <h2 className="mb-4 text-h3 font-bold text-neutral-900">Conteúdo do curso</h2>
        <ol className="space-y-6">
          {modules.map((m) => (
            <li key={m.id}>
              <h3 className="mb-2 text-body-sm font-semibold uppercase tracking-wide text-neutral-500">{m.title}</h3>
              <ol className="divide-y divide-line rounded-lg border border-line">
                {m.lessons.map((l) => {
                  const Icon = LESSON_ICON[l.type as keyof typeof LESSON_ICON] ?? FileText;
                  const isNext = l.id === nextLessonId && status !== "completed";
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/meus-cursos/${course.id}/aulas/${l.id}` as Route}
                        className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500", isNext && "bg-purple-50/60")}
                      >
                        {l.done ? (
                          <CircleCheck aria-label="Concluída" className="size-5 shrink-0 text-green-600" />
                        ) : (
                          <Icon aria-hidden className="size-5 shrink-0 text-neutral-500" />
                        )}
                        <span className={cn("min-w-0 flex-1 text-body-sm", l.done ? "text-neutral-600" : "font-medium text-neutral-900")}>{l.title}</span>
                        {isNext ? <Badge tone="purple">Próxima</Badge> : null}
                        <span className="shrink-0 text-caption text-neutral-600">{formatMinutes(l.durationMinutes)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
