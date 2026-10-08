import { Skeleton } from "@/design-system/components/feedback";

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-4 p-6">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="card mb-6 space-y-4 p-8" aria-hidden>
      <Skeleton className="h-10 w-2/5" />
      <Skeleton className="h-5 w-3/5" />
    </div>
  );
}
