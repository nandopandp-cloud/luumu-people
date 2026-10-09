import { Download, FileText, ImageIcon, MessageCircle, Pin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Badge } from "@/design-system/components/badge";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { Comments } from "@/features/announcements/mural/comments";
import { LikeButton } from "@/features/announcements/mural/like-button";
import { RichText } from "@/features/announcements/rich-text";
import { CourseCover } from "@/features/courses/course-cover";
import { ANNOUNCEMENT_CATEGORY } from "@/features/home/labels";
import { formatDateTime } from "@/lib/format";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { listComments } from "@/server/modules/announcements/engagement";
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
  let comments: Awaited<ReturnType<typeof listComments>>;
  try {
    [a, comments] = await Promise.all([getAnnouncement(actor, id), listComments(actor, id)]);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const cat = ANNOUNCEMENT_CATEGORY[a.category] ?? { label: a.category, tone: "purple" as const };
  const files = a.attachments.filter((x) => x.kind === "file" && x.fileId);
  const videos = a.attachments.filter((x) => x.kind === "video" && x.embedUrl);

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
          {a.body?.trim() ? <RichText source={a.body} className="mt-6 border-t border-line pt-6" /> : null}

          {videos.length ? (
            <section aria-labelledby="videos" className="mt-8 space-y-4">
              <h2 id="videos" className="text-h3 font-bold text-neutral-900">
                {videos.length === 1 ? "Vídeo" : "Vídeos"}
              </h2>
              {videos.map((v) => (
                <figure key={v.id}>
                  <div className="aspect-video overflow-hidden rounded-lg bg-neutral-900">
                    <iframe
                      src={v.embedUrl!}
                      title={`Vídeo: ${v.title}`}
                      className="size-full"
                      allow="encrypted-media; picture-in-picture; fullscreen"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                  </div>
                  <figcaption className="mt-2 text-body-sm text-neutral-600">{v.title}</figcaption>
                </figure>
              ))}
            </section>
          ) : null}

          {files.length ? (
            <section aria-labelledby="anexos" className="mt-8">
              <h2 id="anexos" className="text-h3 font-bold text-neutral-900">
                Arquivos
              </h2>
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                {files.map((f) => {
                  const Icon = f.mimeType === "application/pdf" ? FileText : ImageIcon;
                  return (
                    <li key={f.id}>
                      <a href={`/api/v1/files/${f.fileId}`} download className="group flex items-center gap-3 px-4 py-3 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                          <Icon aria-hidden className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-sm font-medium text-neutral-900 group-hover:text-purple-600">{f.title}</span>
                          <span className="text-caption text-neutral-500">
                            {f.mimeType === "application/pdf" ? "PDF" : "Imagem"}
                            {f.sizeBytes ? ` · ${(f.sizeBytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : ""}
                          </span>
                        </span>
                        <Download aria-hidden className="size-4 text-neutral-500 group-hover:text-purple-600" />
                        <span className="sr-only">Baixar</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="mt-8 flex items-center gap-4 border-y border-line py-3">
            <LikeButton announcementId={a.id} likes={a.likes} likedByMe={a.likedByMe} />
            <a href="#comentarios" className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600 hover:text-purple-600">
              <MessageCircle aria-hidden className="size-[18px]" /> {a.comments} {a.comments === 1 ? "comentário" : "comentários"}
            </a>
          </div>

          <div className="mt-6">
            <Comments
              announcementId={a.id}
              initial={comments.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), author: { name: c.author.name, image: c.author.image }, canDelete: c.canDelete }))}
            />
          </div>
        </div>
      </article>
    </>
  );
}
