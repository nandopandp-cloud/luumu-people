import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import {
  AchievementsCard,
  AnnouncementsSection,
  FeaturedContentSection,
  HomeHero,
  MoodCard,
  MyProgressCard,
  NextActivitiesCard,
  RecommendedPathsSection,
} from "@/features/home/sections";
import type { AuthenticatedActor } from "@/server/auth/session";
import { requireActor } from "@/server/dal";

export const metadata: Metadata = { title: "Início" };

/**
 * Início do colaborador. Cada bloco carrega de forma independente (streaming):
 * o primeiro que ficar pronto aparece primeiro, com skeleton no formato final.
 */
export default function HomePage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-7">
        <Block fallback={<Skeleton className="h-[318px] rounded-[28px]" />}>{(actor) => <HomeHero actor={actor} />}</Block>
        <Block fallback={<RowSkeleton height="h-[230px]" />}>{(actor) => <AnnouncementsSection actor={actor} />}</Block>
        <Block fallback={<RowSkeleton height="h-[136px]" />}>{(actor) => <RecommendedPathsSection actor={actor} />}</Block>
        <Block fallback={<RowSkeleton height="h-[86px]" columns={4} />}>{(actor) => <FeaturedContentSection actor={actor} />}</Block>
      </div>
      <aside className="space-y-5" aria-label="Seu resumo">
        <Block fallback={<Skeleton className="h-[160px] rounded-xl" />}>{(actor) => <MyProgressCard actor={actor} />}</Block>
        <Block fallback={<Skeleton className="h-[360px] rounded-xl" />}>{(actor) => <NextActivitiesCard actor={actor} />}</Block>
        <Block fallback={<Skeleton className="h-[170px] rounded-xl" />}>{(actor) => <MoodCard actor={actor} />}</Block>
        <Block fallback={null}>{(actor) => <AchievementsCard actor={actor} />}</Block>
      </aside>
    </div>
  );
}

function Block({ fallback, children }: { fallback: ReactNode; children: (actor: AuthenticatedActor) => ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <WithActor>{children}</WithActor>
    </Suspense>
  );
}

async function WithActor({ children }: { children: (actor: AuthenticatedActor) => ReactNode }) {
  const actor = await requireActor();
  return children(actor);
}

function RowSkeleton({ height, columns = 3 }: { height: string; columns?: number }) {
  return (
    <div aria-hidden>
      <Skeleton className="mb-3.5 h-6 w-56" />
      <div className={columns === 4 ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 md:grid-cols-3"}>
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className={`${height} rounded-xl`} />
        ))}
      </div>
    </div>
  );
}
