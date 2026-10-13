import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { ConnectionsApp } from "@/features/connections/connections-app";
import { requireActor } from "@/server/dal";
import { connectionsCounts, getMyInterests, listFeatured, listOnlineFriends, listSuggestions } from "@/server/modules/friends/connections";
import { listRequests } from "@/server/modules/friends/service";
import { listLocations, listOrgUnits } from "@/server/modules/organization/service";

export const metadata: Metadata = { title: "Conexões" };

export default function ConnectionsPage() {
  return (
    <Suspense fallback={<ConnectionsSkeleton />}>
      <Connections />
    </Suspense>
  );
}

/** Tudo o que a aba "Descobrir pessoas" e o painel lateral mostram ao abrir. */
async function Connections() {
  const actor = await requireActor();
  const [counts, suggestions, featured, requests, online, myInterests, units, locations] = await Promise.all([
    connectionsCounts(actor),
    listSuggestions(actor, 5),
    listFeatured(actor, 8),
    listRequests(actor),
    listOnlineFriends(actor, 5),
    getMyInterests(actor),
    listOrgUnits(actor),
    listLocations(actor),
  ]);
  return (
    <ConnectionsApp
      initial={{
        counts,
        suggestions,
        featured,
        requests,
        online,
        myInterests,
        areas: units.map((u) => ({ id: u.id, name: u.name })),
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
      }}
    />
  );
}

function ConnectionsSkeleton() {
  return (
    <div aria-hidden className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Skeleton className="h-28 w-2/3 rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-[640px] w-full rounded-xl" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
