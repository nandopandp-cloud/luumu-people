import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { Progress } from "@/design-system/components/progress";
import { CompleteLessonButton } from "@/features/courses/complete-lesson-button";
import { formatMinutes } from "@/features/courses/labels";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getLesson } from "@/server/modules/courses/service";
import { toEmbedUrl } from "@/server/modules/courses/video";

export const metadata: Metadata = { title: "Aula" };

export default function LessonPage({ params }: PageProps<"/meus-cursos/[courseId]/aulas/[lessonId]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[520px] rounded-xl" />}>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/meus-cursos/[courseId]/aulas/[lessonId]">["params"] }) {
  const actor = await requireActor();
  const { courseId, lessonId } = await params;
  if (!z.uuid().safeParse(courseId).success || !z.uuid().safeParse(lessonId).success) notFound();
  let data: Awaited<ReturnType<typeof getLesson>>;
  try {
    data = await getLesson(actor, courseId, lessonId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const { course, lesson, done, position, total, previousId, nextId, progress } = data;
  const embed = lesson.type === "video" ? toEmbedUrl(lesson.videoUrl) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: "Meus cursos", href: "/meus-cursos" }, { label: course.title, href: `/meus-cursos/${course.id}` as Route }, { label: `Aula ${position}` }]} />
        <div className="w-56">
          <Progress value={progress} label="Progresso no curso" />
        </div>
      </div>

      <Card as="article" className="p-6 sm:p-10">
        <p className="text-caption font-semibold uppercase tracking-wide text-purple-600">
          {lesson.moduleTitle} · Aula {position} de {total} · {formatMinutes(lesson.durationMinutes)}
        </p>
        <h1 className="mt-2 text-[1.9rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{lesson.title}</h1>

        <div className="mt-6">
          {lesson.type === "article" && lesson.body ? (
            <div className="max-w-prose space-y-4 text-[17px] leading-relaxed text-neutral-800">
              {lesson.body.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          ) : null}
          {lesson.type === "video" ? (
            embed ? (
              <div className="aspect-video overflow-hidden rounded-xl bg-neutral-900">
                <iframe
                  src={embed}
                  title={`Vídeo: ${lesson.title}`}
                  className="size-full"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  referrerPolicy="strict-origin-when-cross-origin"
                  loading="lazy"
                />
              </div>
            ) : (
              <Alert tone="warning" title="Vídeo indisponível">
                O endereço deste vídeo não é suportado. Avise o time responsável pelo curso.
              </Alert>
            )
          ) : null}
          {lesson.type === "pdf" && lesson.fileId ? (
            <Button asChild variant="secondary">
              <a href={`/api/v1/files/${lesson.fileId}`} target="_blank" rel="noopener">
                <FileText aria-hidden /> Abrir material em PDF
              </a>
            </Button>
          ) : null}
          {lesson.type === "link" && lesson.externalUrl ? (
            <Button asChild variant="secondary">
              <a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden /> Abrir conteúdo externo
              </a>
            </Button>
          ) : null}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          {previousId ? (
            <Button asChild variant="ghost">
              <Link href={`/meus-cursos/${course.id}/aulas/${previousId}` as Route}>
                <ArrowLeft aria-hidden /> Aula anterior
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link href={`/meus-cursos/${course.id}` as Route}>
                <ArrowLeft aria-hidden /> Visão geral do curso
              </Link>
            </Button>
          )}
          <CompleteLessonButton courseId={course.id} lessonId={lesson.id} done={done} nextLessonId={nextId} />
        </div>
      </Card>
    </div>
  );
}
