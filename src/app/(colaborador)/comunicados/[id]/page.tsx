import { Pin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { CourseCover } from "@/features/courses/course-cover";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { formatDateTime } from "@/lib/format";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getAnnouncement } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Comunicado" };

export default function AnnouncementPage({ params }: PageProps<"/comunicados/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
      <Announcement params={params} />
    </Suspense>
  );
}

async function Announcement({ params }: { params: PageProps<"/comunicados/[id]">["params"] }) {
  const actor = await requireActor();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let a: Awaited<ReturnType<typeof getAnnouncement>>;
  try {
    a = await getAnnouncement(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const cat = ANNOUNCEMENT_CATEGORY[a.category] ?? { label: a.category, tone: "purple" as const };
  // Texto puro (nunca HTML): parágrafos separados por linha em branco.
  const paragraphs = (a.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Comunicados", href: "/comunicados" }, { label: a.title }]} />
      </div>
      <article className="card mx-auto max-w-3xl overflow-hidden">
        <CourseCover coverFileId={a.coverFileId} theme={a.theme} illustration={a.illustration} className="h-56 w-full" iconClassName="size-20" />
        <div className="p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cat.tone}>{cat.label}</Badge>
            {a.pinned ? (
              <Badge tone="yellow">
                <Pin aria-hidden /> Fixado
              </Badge>
            ) : null}
            {a.publishedAt ? (
              <time className="text-caption text-neutral-500" dateTime={a.publishedAt.toISOString()}>
                Publicado em {formatDateTime(a.publishedAt)}
              </time>
            ) : null}
          </div>
          <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">{a.title}</h1>
          <p className="mt-2 text-[17px] text-neutral-600">{a.summary}</p>
          {paragraphs.length ? (
            <div className="mt-6 space-y-4 border-t border-line pt-6 text-body leading-relaxed text-neutral-800">
              {paragraphs.map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </article>
    </>
  );
}
