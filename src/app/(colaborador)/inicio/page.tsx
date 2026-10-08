import { ArrowRight, Box, Library, Megaphone, SquareCheckBig, TrendingUp, Waypoints, type LucideIcon } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Badge } from "@/design-system/components/badge";
import { Mascot } from "@/design-system/components/brand";
import { Button } from "@/design-system/components/button";
import { Card, CardHeader, SeeAllLink } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { cn } from "@/design-system/cn";
import { requireActor } from "@/server/dal";
import { getMyProfile } from "@/server/modules/people/service";

export const metadata: Metadata = { title: "Início" };

const MODULES: { href: Route; title: string; description: string; icon: LucideIcon; tone: string; phase: string }[] = [
  { href: "/meus-cursos", title: "Meus cursos", description: "Treinamentos, prazos e progresso.", icon: Box, tone: "bg-purple-100 text-purple-600", phase: "Fase 2" },
  { href: "/trilhas", title: "Trilhas", description: "Jornadas de aprendizagem para você.", icon: Waypoints, tone: "bg-green-100 text-green-700", phase: "Fase 2" },
  { href: "/desenvolvimento", title: "Desenvolvimento", description: "Competências, PDI e metas.", icon: TrendingUp, tone: "bg-orange-100 text-orange-700", phase: "Fase 3" },
  { href: "/pesquisas", title: "Pesquisas", description: "Sua voz para melhorar o ambiente.", icon: SquareCheckBig, tone: "bg-blue-100 text-blue-700", phase: "Fase 4" },
  { href: "/comunicados", title: "Comunicados", description: "Novidades e eventos da empresa.", icon: Megaphone, tone: "bg-pink-100 text-pink-700", phase: "Fase 2" },
  { href: "/biblioteca", title: "Biblioteca", description: "Artigos, vídeos e podcasts.", icon: Library, tone: "bg-yellow-100 text-yellow-700", phase: "Fase 2" },
];

export default function HomePage() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-6">
        <Suspense fallback={<HeroSkeleton />}>
          <Hero />
        </Suspense>

        <section aria-labelledby="explorar">
          <h2 id="explorar" className="mb-4 text-h3 font-bold text-neutral-900">
            Sua jornada na Luumu People
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {MODULES.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="card group flex h-full items-start gap-4 p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-purple-500">
                  <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", m.tone)}>
                    <m.icon aria-hidden className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-h4 font-semibold text-neutral-900 group-hover:text-purple-600">{m.title}</span>
                    <span className="mt-1 block text-body-sm text-neutral-500">{m.description}</span>
                    <Badge tone="neutral" className="mt-3">
                      Em breve · {m.phase}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-6" aria-label="Resumo">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileSummary />
        </Suspense>
      </aside>
    </div>
  );
}

async function Hero() {
  const actor = await requireActor();
  const profile = await getMyProfile(actor);
  const firstName = (profile.preferredName || profile.name).split(" ")[0];
  return (
    <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-100 via-[#e9e1fb] to-purple-200 px-6 py-8 sm:px-10 sm:py-10">
      <div aria-hidden className="absolute -right-10 bottom-0 size-72 rounded-full bg-white/40 blur-2xl" />
      <div aria-hidden className="absolute right-56 top-8 size-20 rounded-full bg-white/50" />
      <div className="relative flex items-end gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-h4 font-semibold text-neutral-800">
            Olá, {firstName}! <span aria-hidden>👋</span>
          </p>
          <h1 className="mt-3 max-w-xl text-[2rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-neutral-900 sm:text-[2.5rem]">
            Pessoas que aprendem hoje constroem o amanhã.
          </h1>
          <p className="mt-4 max-w-md text-body text-neutral-700">Explore conteúdos, desenvolva suas habilidades e faça parte de uma cultura que cresce junta.</p>
          <Button asChild size="lg" className="mt-7">
            <Link href="/meu-perfil">
              Ver meu perfil <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
        <Mascot className="relative hidden h-56 shrink-0 md:block" />
      </div>
    </section>
  );
}

async function ProfileSummary() {
  const actor = await requireActor();
  const profile = await getMyProfile(actor);
  return (
    <Card>
      <CardHeader title="Meu perfil" action={<SeeAllLink href="/meu-perfil">Ver tudo</SeeAllLink>} />
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} src={profile.image} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-h4 font-semibold text-neutral-900">{profile.preferredName || profile.name}</p>
          <p className="truncate text-body-sm text-neutral-500">{[profile.position, profile.orgUnit].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-body-sm">
        <div>
          <dt className="text-neutral-500">Gestor(a)</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">{profile.managerName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Unidade</dt>
          <dd className="mt-0.5 font-medium text-neutral-800">{profile.city ? `${profile.city}${profile.state && profile.state !== "BR" ? ` - ${profile.state}` : ""}` : "—"}</dd>
        </div>
      </dl>
    </Card>
  );
}

function HeroSkeleton() {
  return (
    <div className="space-y-4 rounded-xl bg-purple-50 p-10" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="card space-y-4 p-6" aria-hidden>
      <Skeleton className="h-5 w-24" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}
