import { ArrowRight, ChevronRight, Clock3, ExternalLink, MessageCircle, Paperclip, Pin, Video } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/design-system/components/badge";
import { SeeAllLink } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";
import type { CoverIllustration, CoverTheme } from "@/design-system/illustrations/cover-art";
import { CourseCover } from "@/features/courses/course-cover";
import { ANNOUNCEMENT_CATEGORY, relativeDay } from "@/features/home/labels";
import { EVENT_KIND, eventDay, eventMonth, eventTime, eventWhere, QUICK_LINK_COLOR, QUICK_LINK_ICON } from "./labels";
import { LikeButton } from "./like-button";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type FeedItem = {
  id: string;
  title: string;
  summary: string;
  category: string;
  theme: CoverTheme;
  illustration: CoverIllustration;
  pinned: boolean;
  coverFileId: string | null;
  publishedAt: Date | null;
  likes: number;
  likedByMe: boolean;
  comments: number;
  files: number;
  videos: number;
  forMyArea: boolean;
};

/** Card de comunicado da lista do mural: capa, categoria, data, resumo, curtidas, comentários e anexos. */
export function AnnouncementRow({ item }: { item: FeedItem }) {
  const cat = ANNOUNCEMENT_CATEGORY[item.category] ?? { label: item.category, tone: "purple" as const };
  const href = `/comunicados/${item.id}` as Route;
  return (
    <article className="group relative flex flex-col gap-4 rounded-xl border border-line bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-stretch">
      <CourseCover coverFileId={item.coverFileId} theme={item.theme} illustration={item.illustration} className="h-40 w-full shrink-0 rounded-lg sm:h-auto sm:min-h-[132px] sm:w-[240px]" iconClassName="size-12" />
      <div className="flex min-w-0 flex-1 flex-col px-1 pb-1 sm:py-1 sm:pr-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={cat.tone}>{cat.label}</Badge>
          {item.pinned ? (
            <Badge tone="yellow">
              <Pin aria-hidden /> Fixado
            </Badge>
          ) : null}
          {item.forMyArea ? <Badge tone="blue">Para sua área</Badge> : null}
          <time className="ml-auto text-caption text-neutral-500" dateTime={item.publishedAt?.toISOString()}>
            {relativeDay(item.publishedAt)}
          </time>
        </div>
        <h3 className="mt-2 text-h4 font-bold leading-snug text-neutral-900">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-xl group-hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
            {item.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-body-sm text-neutral-600">{item.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          <LikeButton announcementId={item.id} likes={item.likes} likedByMe={item.likedByMe} className="-ml-1.5" />
          <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
            <MessageCircle aria-hidden className="size-[18px]" />
            <span className="tabular-nums">{item.comments}</span>
            <span className="sr-only">{item.comments === 1 ? "comentário" : "comentários"}</span>
          </span>
          {item.files > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
              <Paperclip aria-hidden className="size-[18px]" /> {plural(item.files, "arquivo", "arquivos")}
            </span>
          ) : null}
          {item.videos > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral-600">
              <Video aria-hidden className="size-[18px]" /> {plural(item.videos, "vídeo", "vídeos")}
            </span>
          ) : null}
          <span aria-hidden className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-purple-100 px-4 text-body-sm font-semibold text-purple-600 transition-colors group-hover:bg-purple-200/70">
            Ler mais <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

export type UpcomingEvent = { id: string; title: string; kind: string; mode: string; location: string | null; startsAt: Date };

/** Próximos eventos: data em destaque, tipo, horário e formato. */
export function UpcomingEventsCard({ events, seeAll = true }: { events: UpcomingEvent[]; seeAll?: boolean }) {
  return (
    <section aria-labelledby="proximos-eventos" className="card p-5">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 id="proximos-eventos" className="text-h4 font-bold text-neutral-900">
          Próximos eventos
        </h2>
        {events.length > 0 && seeAll ? <SeeAllLink href="/comunicados/eventos">Ver todos</SeeAllLink> : null}
      </header>
      {events.length === 0 ? (
        <p className="py-3 text-body-sm text-neutral-600">Nenhum evento agendado por enquanto.</p>
      ) : (
        <ul className="divide-y divide-line">
          {events.map((e) => {
            const kind = EVENT_KIND[e.kind] ?? { label: e.kind, tone: "purple" as const };
            return (
              <li key={e.id}>
                <Link href={`/comunicados/eventos/${e.id}` as Route} className="group flex items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
                  <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-purple-50 py-1.5 text-purple-600">
                    <span className="text-h3 font-extrabold leading-none">{eventDay(e.startsAt)}</span>
                    <span className="mt-0.5 text-caption font-semibold">{eventMonth(e.startsAt)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <Badge tone={kind.tone}>{kind.label}</Badge>
                    <span className="mt-1 block truncate text-body-sm font-semibold text-neutral-900 group-hover:text-purple-600">{e.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-caption text-neutral-600">
                      <Clock3 aria-hidden className="size-3.5" />
                      <time dateTime={e.startsAt.toISOString()}>{eventTime(e.startsAt)}</time> • {eventWhere(e)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-neutral-500 group-hover:text-purple-600" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type QuickLinkItem = { id: string; label: string; url: string; icon: string; color: string };

/** Atalhos da empresa (benefícios, políticas, canais de ajuda…). */
export function QuickLinksCard({ links }: { links: QuickLinkItem[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="links-rapidos" className="card p-5">
      <h2 id="links-rapidos" className="mb-4 text-h4 font-bold text-neutral-900">
        Links rápidos
      </h2>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
        {links.map((l) => {
          const Icon = (QUICK_LINK_ICON[l.icon] ?? QUICK_LINK_ICON.link!).icon;
          const color = QUICK_LINK_COLOR[l.color] ?? QUICK_LINK_COLOR.purple!;
          const external = l.url.startsWith("https://");
          const content = (
            <>
              <span className={cn("flex size-14 items-center justify-center rounded-lg transition-transform group-hover:-translate-y-0.5", color.tile)}>
                <Icon aria-hidden className="size-6" />
              </span>
              <span className="mt-2 text-caption font-medium leading-tight text-neutral-800 group-hover:text-purple-600">
                {l.label}
                {external ? (
                  <>
                    <ExternalLink aria-hidden className="ml-0.5 inline size-3 align-[-1px] text-neutral-500" />
                    <span className="sr-only"> (abre em nova aba)</span>
                  </>
                ) : null}
              </span>
            </>
          );
          const className = "group flex flex-col items-center text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 rounded-md";
          return (
            <li key={l.id}>
              {external ? (
                <a href={l.url} target="_blank" rel="noopener noreferrer" className={className}>
                  {content}
                </a>
              ) : (
                <Link href={l.url as Route} className={className}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
