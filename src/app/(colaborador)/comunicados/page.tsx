import { ArrowRight, Pin } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { CourseCover } from "@/features/courses/course-cover";
import { cn } from "@/design-system/cn";
import { ANNOUNCEMENT_CATEGORY, relativeDay } from "@/features/home/labels";
import { PageHero } from "@/features/page/page-hero";
import { ANNOUNCEMENT_CATEGORIES } from "@/server/db/schema/learning";
import { requireActor } from "@/server/dal";
import { listAnnouncements, type AnnouncementCategory } from "@/server/modules/announcements/service";

export const metadata: Metadata = { title: "Comunicados" };

type SP = PageProps<"/comunicados">["searchParams"];

async function parse(searchParams: SP) {
  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const categoria = one(raw.categoria);
  return {
    category: (ANNOUNCEMENT_CATEGORIES as readonly string[]).includes(categoria ?? "") ? (categoria as AnnouncementCategory) : undefined,
    limit: Math.min(60, Math.max(9, Number(one(raw.mais)) || 9)),
  };
}

export default function AnnouncementsPage({ searchParams }: PageProps<"/comunicados">) {
  return (
    <>
      <PageHero
        title="Comunicados"
        description="Fique por dentro das novidades, iniciativas e tudo o que acontece na nossa empresa."
        bubble="Informação também aproxima pessoas!"
      />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Feed({ searchParams }: { searchParams: SP }) {
  const [actor, { category, limit }] = await Promise.all([requireActor(), parse(searchParams)]);
  const { items, total } = await listAnnouncements(actor, { category, limit });
  const href = (c?: AnnouncementCategory, mais?: number) => ({ pathname: "/comunicados", query: { ...(c && { categoria: c }), ...(mais && { mais: String(mais) }) } });

  return (
    <section aria-labelledby="mural">
      <h2 id="mural" className="sr-only">
        Mural de comunicados
      </h2>
      <nav aria-label="Filtrar por categoria" className="mb-5">
        <ul className="flex flex-wrap gap-1.5">
          {[undefined, ...ANNOUNCEMENT_CATEGORIES].map((c) => (
            <li key={c ?? "todas"}>
              <Link
                href={href(c)}
                scroll={false}
                aria-current={c === category ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-4 text-body-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                  c === category ? "bg-purple-500 text-white" : "bg-white text-neutral-600 ring-1 ring-line hover:bg-purple-50 hover:text-purple-600",
                )}
              >
                {c ? ANNOUNCEMENT_CATEGORY[c]?.label : "Todos"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            title={category ? "Nenhum comunicado nesta categoria" : "Nenhum comunicado por enquanto"}
            description={category ? "Veja todos os comunicados ou escolha outra categoria." : "Quando houver novidades para você, elas aparecem aqui."}
            action={
              category ? (
                <Button asChild variant="soft">
                  <Link href="/comunicados">Ver todos</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((a, index) => {
            const cat = ANNOUNCEMENT_CATEGORY[a.category] ?? { label: a.category, tone: "purple" as const };
            const featured = index === 0 && a.pinned && !category;
            return (
              <li key={a.id} className={featured ? "md:col-span-2 xl:col-span-3" : undefined}>
                <article className={cn("group relative flex h-full overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md", featured ? "flex-col md:flex-row" : "flex-col")}>
                  <CourseCover coverFileId={a.coverFileId} theme={a.theme} illustration={a.illustration} className={featured ? "h-36 w-full shrink-0 md:h-auto md:w-[40%]" : "h-[110px] w-full shrink-0"} iconClassName={featured ? "size-16" : undefined} />
                  <div className={cn("flex flex-1 flex-col", featured ? "p-6 sm:p-8" : "p-4")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={cat.tone}>{cat.label}</Badge>
                      {a.pinned ? (
                        <Badge tone="yellow">
                          <Pin aria-hidden /> Fixado
                        </Badge>
                      ) : null}
                      <time className="ml-auto text-caption text-neutral-500" dateTime={a.publishedAt?.toISOString()}>
                        {relativeDay(a.publishedAt)}
                      </time>
                    </div>
                    <h3 className={cn("mt-3 font-semibold leading-snug text-neutral-900", featured ? "text-h3" : "text-[15px]")}>
                      <Link href={`/comunicados/${a.id}` as Route} className="after:absolute after:inset-0 group-hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
                        {a.title}
                      </Link>
                    </h3>
                    <p className={cn("mt-1 text-neutral-600", featured ? "text-body" : "line-clamp-2 text-body-sm")}>{a.summary}</p>
                    <span aria-hidden className="mt-auto inline-flex items-center gap-1 pt-3 text-body-sm font-medium text-purple-600">
                      Ler comunicado <ArrowRight className="size-4" />
                    </span>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {total > items.length ? (
        <div className="mt-5 text-center">
          <Button asChild variant="secondary">
            <Link href={href(category, limit + 9)} scroll={false}>
              Ver mais ({total - items.length})
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="mb-5 h-9 w-full max-w-xl rounded-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-[250px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
