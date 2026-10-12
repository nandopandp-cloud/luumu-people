import { ChevronRight, MapPin, Network, UsersRound } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Card, CardHeader } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { ProfileCoverArt } from "@/design-system/illustrations/profile-cover";
import { MoodStatusPill, OnlinePill, PresenceAvatar } from "@/features/friends/person-bits";
import { BackToFriends, ProfileActions } from "@/features/friends/profile-actions";
import { requireActor } from "@/server/dal";
import { HttpError } from "@/server/http/errors";
import { getColleagueProfile } from "@/server/modules/friends/service";

export const metadata: Metadata = { title: "Perfil" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ColleaguePage({ params }: PageProps<"/pessoas/[userId]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Colleague params={params} />
    </Suspense>
  );
}

async function Colleague({ params }: { params: PageProps<"/pessoas/[userId]">["params"] }) {
  const [actor, { userId }] = await Promise.all([requireActor(), params]);
  if (!UUID.test(userId)) notFound();
  const profile = await getColleagueProfile(actor, userId).catch((error) => {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  });
  const p = profile;
  return (
    <div className="space-y-6">
      <BackToFriends />
      <section aria-labelledby="perfil-colega" className="card overflow-hidden p-0">
        <div className="relative h-44 sm:h-52">
          {p.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pela própria API
            <img src={p.cover} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <ProfileCoverArt className="absolute inset-0 size-full" />
          )}
        </div>
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end sm:px-8">
          <PresenceAvatar name={p.name} image={p.image} online={p.online} size="xl" className="-mt-16 self-start rounded-full ring-4 ring-white" />
          <div className="min-w-0 flex-1">
            <h1 id="perfil-colega" className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">
              {p.name}
            </h1>
            {p.position ? <p className="mt-1 text-body text-neutral-700">{p.position}</p> : null}
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-body-sm text-neutral-700">
              {p.orgUnit ? (
                <li className="flex items-center gap-1.5">
                  <Network aria-hidden className="size-4 text-neutral-500" />
                  <span className="sr-only">Área:</span> {p.orgUnit}
                </li>
              ) : null}
              {p.location ? (
                <li className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-neutral-500" />
                  <span className="sr-only">Local:</span> {p.location}
                </li>
              ) : null}
            </ul>
            {p.online || p.mood ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.online ? <OnlinePill /> : null}
                <MoodStatusPill mood={p.mood} />
              </div>
            ) : null}
          </div>
          <ProfileActions person={{ id: p.id, name: p.name, relation: p.relation }} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Sobre" />
          <p className="text-body text-neutral-700">{p.headline ? `“${p.headline}”` : `${p.name.split(" ")[0]} ainda não escreveu uma frase no perfil.`}</p>
        </Card>
        <Card>
          <CardHeader title="Amigos em comum" description={p.mutualCount ? `${p.mutualCount} ${p.mutualCount === 1 ? "amigo" : "amigos"} em comum` : undefined} />
          {p.mutualFriends.length ? (
            <ul className="space-y-2">
              {p.mutualFriends.map((f) => (
                <li key={f.id}>
                  <Link href={`/pessoas/${f.id}` as Route} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                    <Avatar name={f.name} src={f.image} size="md" className="ring-0" />
                    <span className="text-body-sm font-medium text-neutral-900">{f.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-neutral-600">Nenhum amigo em comum ainda.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Grupos em comum" />
          {p.groupsInCommon.length ? (
            <ul className="space-y-1">
              {p.groupsInCommon.map((g) => (
                <li key={g.id}>
                  <Link href={`/conversas?conversa=${g.id}` as Route} className="flex items-center gap-3 rounded-lg p-2 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500">
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                      <UsersRound className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-sm font-semibold text-neutral-900">{g.title}</span>
                      <span className="block text-caption text-neutral-600">
                        {g.memberCount} {g.memberCount === 1 ? "membro" : "membros"}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-neutral-500" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-neutral-600">Nenhum grupo em comum.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando perfil" className="space-y-6">
      <Skeleton className="h-8 w-28 rounded-full" />
      <Skeleton className="h-80 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
