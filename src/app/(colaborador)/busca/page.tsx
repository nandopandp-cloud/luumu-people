import { Search } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/design-system/components/empty-state";
import { Skeleton } from "@/design-system/components/feedback";
import { SEARCH_KIND_ICON } from "@/features/search/icons";
import { requireActor } from "@/server/dal";
import { search } from "@/server/modules/search/service";

export const metadata: Metadata = { title: "Busca" };

/** Resultados completos da busca (o "ver todos" da paleta; funciona sem JavaScript). */
export default function SearchPage({ searchParams }: PageProps<"/busca">) {
  return (
    <>
      <header className="mb-6">
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Busca</h1>
        <p className="mt-1 text-body text-neutral-600">Comunicados, pesquisas, pessoas e páginas em um só lugar.</p>
      </header>
      <Suspense fallback={<Skeleton className="h-[320px] rounded-xl" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/busca">["searchParams"] }) {
  const actor = await requireActor();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 80) ?? "";
  const groups = q.length >= 2 ? await search(actor, q, "employee") : [];

  return (
    <div className="space-y-6">
      <form role="search" action="/busca" className="relative max-w-2xl">
        <label htmlFor="busca-q" className="sr-only">
          Buscar
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-neutral-500" />
        <input
          id="busca-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="O que você procura?"
          className="h-12 w-full rounded-full border border-line bg-white pl-13 pr-5 text-body-sm shadow-sm placeholder:text-neutral-500 focus:border-purple-400 focus:outline-none focus:ring-4 focus:ring-purple-100"
        />
      </form>
      {q.length < 2 ? (
        <p className="text-body-sm text-neutral-600">Digite ao menos 2 letras. Dica: use ⌘K (ou Ctrl+K) em qualquer tela.</p>
      ) : groups.length === 0 ? (
        <div className="card p-6">
          <EmptyState title={`Nada encontrado para “${q}”`} description="Tente outra palavra ou um termo mais curto." />
        </div>
      ) : (
        groups.map((g) => {
          const Icon = SEARCH_KIND_ICON[g.kind];
          return (
            <section key={g.kind} aria-labelledby={`busca-${g.kind}`} className="card p-5">
              <h2 id={`busca-${g.kind}`} className="mb-3 text-body-sm font-semibold uppercase tracking-wide text-neutral-500">
                {g.label}
              </h2>
              <ul className="divide-y divide-line">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href as Route} className="flex items-center gap-3 py-3 hover:text-purple-600">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
                        <Icon aria-hidden className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm font-semibold text-neutral-900">{item.title}</span>
                        {item.subtitle ? <span className="block truncate text-caption text-neutral-500">{item.subtitle}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
