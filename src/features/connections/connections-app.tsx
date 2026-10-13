"use client";

import { Bell, Filter, Search, Sparkles, UserPlus, UserRoundSearch, UsersRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Skeleton } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { Select } from "@/design-system/components/select";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { INTERESTS } from "@/lib/interests";
import { connectionsApi, errorMessage, friendsApi } from "@/features/friends/client";
import { chatDock } from "@/features/friends/dock-store";
import { ConfirmDialog } from "@/features/friends/group-dialogs";
import { MoodMark } from "@/features/friends/person-bits";
import type { ConnectionCard, ConnectionsCounts, DiscoverFilter, FriendRequests } from "@/features/friends/types";
import { MoodArt } from "@/features/wellbeing/mood-art";
import { NOTIFICATIONS_CHANGED } from "@/features/notifications/labels";
import { InterestChip } from "./interest-icon";
import { InterestsDialog } from "./interests-dialog";
import { FeaturedTile, FriendMenu, PersonTile, type PersonActions } from "./person-tiles";

export type ConnectionsTab = "descobrir" | "conexoes" | "solicitacoes" | "sugestoes";

type Option = { id: string; name: string };
type Initial = {
  counts: ConnectionsCounts;
  suggestions: ConnectionCard[];
  featured: ConnectionCard[];
  requests: FriendRequests;
  online: { items: ConnectionCard[]; total: number };
  myInterests: string[];
  areas: Option[];
  locations: Option[];
};

const PAGE = 20;
const FILTERS: { value: DiscoverFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "equipe", label: "Minha equipe" },
  { value: "departamento", label: "Mesmo departamento" },
  { value: "interesses", label: "Mesmos interesses" },
];
type MoreFilters = { area: string; local: string; interesse: string };
const NO_MORE: MoreFilters = { area: "", local: "", interesse: "" };

function setTabUrl(tab: ConnectionsTab) {
  const url = new URL(window.location.href);
  if (tab === "descobrir") url.searchParams.delete("aba");
  else url.searchParams.set("aba", tab);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/** Cartões de solicitação: relação "recebida" ou "enviada" (o pedido carrega o cartão básico). */
function asCard(person: FriendRequests["received"][number]["person"]): ConnectionCard {
  return { ...person, commonInterests: [], sameTeam: false, cover: null };
}

export function ConnectionsApp({ initial }: { initial: Initial }) {
  const toast = useToast();
  const params = useSearchParams();
  const tab = (["conexoes", "solicitacoes", "sugestoes"].includes(params.get("aba") ?? "") ? params.get("aba") : "descobrir") as ConnectionsTab;

  const [counts, setCounts] = useState(initial.counts);
  const [suggestions, setSuggestions] = useState(initial.suggestions);
  const [featured, setFeatured] = useState(initial.featured);
  const [showAllFeatured, setShowAllFeatured] = useState(false);
  const [requests, setRequests] = useState(initial.requests);
  const [online, setOnline] = useState(initial.online);
  const [myInterests, setMyInterests] = useState(initial.myInterests);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [unfriending, setUnfriending] = useState<ConnectionCard | null>(null);

  // Busca e filtros (aba Descobrir).
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DiscoverFilter>("todos");
  const [more, setMore] = useState<MoreFilters>(NO_MORE);
  const [moreOpen, setMoreOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [results, setResults] = useState<{ items: ConnectionCard[]; total: number } | null>(null);
  const searching = q.trim().length > 0 || filter !== "todos" || Boolean(more.area || more.local || more.interesse);

  // Abas carregadas sob demanda.
  const [friends, setFriends] = useState<ConnectionCard[] | null>(null);
  const [allSuggestions, setAllSuggestions] = useState<ConnectionCard[] | null>(null);
  const [friendsSearch, setFriendsSearch] = useState("");

  /** Aplica uma mudança no cartão da pessoa em todas as listas da página. */
  const patch = useCallback((id: string, change: Partial<ConnectionCard>) => {
    const apply = (list: ConnectionCard[]) => list.map((c) => (c.id === id ? { ...c, ...change } : c));
    setSuggestions(apply);
    setFeatured(apply);
    setResults((r) => (r ? { ...r, items: apply(r.items) } : r));
    setFriends((l) => (l ? apply(l) : l));
    setAllSuggestions((l) => (l ? apply(l) : l));
  }, []);

  const refreshSide = useCallback(async () => {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    try {
      const [c, r, o] = await Promise.all([connectionsApi.counts(), friendsApi.requests(), connectionsApi.online(5)]);
      setCounts(c);
      setRequests(r);
      setOnline(o);
    } catch {
      /* silencioso: os contadores voltam na próxima ação */
    }
  }, []);

  const actions: PersonActions = useMemo(
    () => ({
      async connect(card) {
        try {
          const { relation } = await friendsApi.request(card.id);
          patch(card.id, { relation });
          toast({ tone: "success", title: relation === "friends" ? `Agora você e ${card.name.split(" ")[0]} estão conectados! 💜` : "Pedido de conexão enviado." });
          void refreshSide();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível conectar.", description: errorMessage(error) });
        }
      },
      async accept(card) {
        try {
          await friendsApi.accept(card.id);
          patch(card.id, { relation: "friends" });
          setFriends(null);
          toast({ tone: "success", title: `Agora você e ${card.name.split(" ")[0]} estão conectados! 💜` });
          void refreshSide();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível aceitar.", description: errorMessage(error) });
        }
      },
      async dismissRequest(card) {
        try {
          await friendsApi.dismiss(card.id);
          patch(card.id, { relation: "none" });
          void refreshSide();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível atualizar o pedido.", description: errorMessage(error) });
        }
      },
      unfriend(card) {
        setUnfriending(card);
      },
      async message(card) {
        try {
          const { id } = await friendsApi.open({ kind: "direct", userId: card.id });
          chatDock.open(id);
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
        }
      },
    }),
    [patch, refreshSide, toast],
  );

  async function dismissSuggestion(card: ConnectionCard) {
    setSuggestions((list) => list.filter((c) => c.id !== card.id));
    setAllSuggestions((list) => (list ? list.filter((c) => c.id !== card.id) : list));
    try {
      await connectionsApi.dismiss(card.id);
      setSuggestions((await connectionsApi.suggestions(5)).items);
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível dispensar a sugestão.", description: errorMessage(error) });
    }
  }

  // Resultados da busca/filtros (com espera curta enquanto digita).
  useEffect(() => {
    if (!searching) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      connectionsApi
        .discover({ q: q.trim(), filtro: filter, area: more.area || undefined, local: more.local || undefined, interesse: more.interesse || undefined, limit })
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults({ items: [], total: 0 }));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [searching, q, filter, more, limit]);

  // Abas sob demanda.
  useEffect(() => {
    let alive = true;
    if (tab === "conexoes" && friends === null) {
      connectionsApi
        .discover({ filtro: "conexoes", limit: 60 })
        .then((r) => alive && setFriends(r.items))
        .catch(() => alive && setFriends([]));
    }
    if (tab === "sugestoes" && allSuggestions === null) {
      connectionsApi
        .suggestions(30)
        .then((r) => alive && setAllSuggestions(r.items))
        .catch(() => alive && setAllSuggestions([]));
    }
    return () => {
      alive = false;
    };
  }, [tab, friends, allSuggestions]);

  const go = (next: ConnectionsTab) => {
    setTabUrl(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const moreCount = [more.area, more.local, more.interesse].filter(Boolean).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <ConnectionsHeader />
        <Tabs tab={tab} counts={counts} onChange={go} />

        <section className="card mt-5 p-5 sm:p-6" aria-label={TAB_LABEL[tab]}>
          {tab === "descobrir" ? (
            <>
              <Input
                type="search"
                aria-label="Buscar pessoas"
                placeholder="Buscar por nome, cargo, equipe, habilidade..."
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                leading={<Search />}
                className="h-12 rounded-xl"
              />
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar pessoas">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => {
                      setFilter(f.value);
                      setLimit(PAGE);
                    }}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full px-4 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                      filter === f.value ? "bg-purple-500 font-semibold text-white shadow-sm" : "bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-700",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-body-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
                    moreCount ? "border-purple-500 bg-purple-50 text-purple-700" : "border-line bg-white text-neutral-800 hover:bg-neutral-50",
                  )}
                >
                  <Filter aria-hidden className="size-4" /> Mais filtros
                  {moreCount ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-purple-500 text-[11px] text-white">{moreCount}</span> : null}
                </button>
              </div>

              {myInterests.length === 0 ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                  <Sparkles aria-hidden className="size-5 text-purple-600" />
                  <p className="min-w-0 flex-1 text-body-sm text-neutral-800">Conte seus interesses para encontrar pessoas com afinidades com você.</p>
                  <Button size="sm" variant="secondary" onClick={() => setInterestsOpen(true)}>
                    Escolher interesses
                  </Button>
                </div>
              ) : null}

              {searching ? (
                <Results results={results} actions={actions} onMore={() => setLimit((l) => l + PAGE)} onClear={() => {
                  setQ("");
                  setFilter("todos");
                  setMore(NO_MORE);
                }} />
              ) : (
                <>
                  <SectionHeader
                    title="Pessoas que você talvez conheça"
                    subtitle="Com base no seu time, interesses e interações na plataforma."
                    action={suggestions.length ? <SeeAll onClick={() => go("sugestoes")} /> : null}
                  />
                  {suggestions.length ? (
                    <div className="@container">
                      <ul className="grid grid-cols-2 gap-3 @min-[460px]:grid-cols-3 @min-[620px]:grid-cols-4 @min-[780px]:grid-cols-5">
                        {suggestions.slice(0, 5).map((card) => (
                          <li key={card.id}>
                            <PersonTile card={card} actions={actions} onDismiss={dismissSuggestion} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <EmptyLine>Você já se conectou com todo mundo por aqui. 💜</EmptyLine>
                  )}

                  <SectionHeader
                    title="Pessoas em destaque"
                    subtitle="Colaboradores que estão compartilhando conteúdo e interagindo na plataforma."
                    action={featured.length > 4 ? <SeeAll onClick={() => setShowAllFeatured((v) => !v)} label={showAllFeatured ? "Ver menos" : "Ver todas"} /> : null}
                  />
                  <div className="@container">
                    <ul className="grid grid-cols-1 gap-3 @min-[440px]:grid-cols-2 @min-[760px]:grid-cols-4">
                      {(showAllFeatured ? featured : featured.slice(0, 4)).map((card) => (
                        <li key={card.id}>
                          <FeaturedTile card={card} actions={actions} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          ) : null}

          {tab === "conexoes" ? (
            <FriendsTab friends={friends} search={friendsSearch} onSearch={setFriendsSearch} actions={actions} onFind={() => go("descobrir")} />
          ) : null}
          {tab === "solicitacoes" ? <RequestsTab requests={requests} actions={actions} /> : null}
          {tab === "sugestoes" ? (
            <>
              <SectionHeader title="Sugestões para você" subtitle="Pessoas com afinidades com você: do seu time, do seu departamento, com amigos ou interesses em comum." first />
              <TileGrid items={allSuggestions} empty="Sem novas sugestões por enquanto." render={(card) => <PersonTile card={card} actions={actions} onDismiss={dismissSuggestion} />} />
            </>
          ) : null}
        </section>
      </div>

      <aside aria-label="Resumo de conexões" className="space-y-5">
        <RequestsCard requests={requests} count={counts.received} actions={actions} onSeeAll={() => go("solicitacoes")} />
        <OnlineCard online={online} onSeeAll={() => go("conexoes")} />
        <InterestsCard interests={myInterests} onEdit={() => setInterestsOpen(true)} />
      </aside>

      <InterestsDialog
        initial={myInterests}
        open={interestsOpen}
        onOpenChange={setInterestsOpen}
        onSaved={async (keys) => {
          setMyInterests(keys);
          try {
            setSuggestions((await connectionsApi.suggestions(5)).items);
          } catch {
            /* segue com as sugestões atuais */
          }
        }}
      />
      <MoreFiltersDialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        value={more}
        areas={initial.areas}
        locations={initial.locations}
        onApply={(value) => {
          setMore(value);
          setLimit(PAGE);
        }}
      />
      <ConfirmDialog
        open={unfriending !== null}
        onOpenChange={(open) => !open && setUnfriending(null)}
        title={`Desfazer amizade com ${unfriending?.name.split(" ")[0] ?? ""}?`}
        description="A conversa de vocês fica no histórico, mas ninguém poderá enviar novas mensagens até que voltem a se conectar."
        confirm="Desfazer amizade"
        onConfirm={async () => {
          if (!unfriending) return;
          try {
            await friendsApi.unfriend(unfriending.id);
            patch(unfriending.id, { relation: "none", online: false });
            setFriends((list) => (list ? list.filter((c) => c.id !== unfriending.id) : list));
            void refreshSide();
          } catch (error) {
            toast({ tone: "error", title: "Não foi possível desfazer a amizade.", description: errorMessage(error) });
          }
        }}
      />
    </div>
  );
}

const TAB_LABEL: Record<ConnectionsTab, string> = { descobrir: "Descobrir pessoas", conexoes: "Minhas conexões", solicitacoes: "Solicitações", sugestoes: "Sugestões" };

function ConnectionsHeader() {
  return (
    <header className="relative flex min-h-[150px] items-start justify-between gap-6">
      <div className="min-w-0 pt-2">
        <h1 className="text-[2.5rem] font-extrabold leading-[1.1] tracking-[-0.03em] text-neutral-900 sm:text-display">Conexões</h1>
        <p className="mt-2 max-w-xl text-body text-neutral-700 sm:text-[17px]">Encontre pessoas, faça novas conexões e troque ideias com seus colegas.</p>
      </div>
      <div aria-hidden className="relative hidden h-[150px] w-[340px] shrink-0 md:block">
        <div className="absolute -left-6 top-1 z-10 w-[220px] rounded-xl border border-line bg-white px-4 py-3 text-body-sm font-medium leading-snug text-neutral-800 shadow-md">
          Grandes ideias acontecem quando boas pessoas se conectam!
          <span className="absolute -right-2 top-8 size-4 rotate-45 border-r border-t border-line bg-white" />
        </div>
        <span className="absolute bottom-3 right-[118px] h-12 w-8 -rotate-[35deg] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-green-500" />
        <span className="absolute bottom-6 right-0 h-14 w-9 rotate-[30deg] rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-green-600" />
        <MoodArt slug="ola-maos" className="absolute -top-2 right-4 h-[160px] w-auto drop-shadow-md" />
      </div>
    </header>
  );
}

function Tabs({ tab, counts, onChange }: { tab: ConnectionsTab; counts: ConnectionsCounts; onChange: (tab: ConnectionsTab) => void }) {
  const items: { value: ConnectionsTab; label: string; icon: typeof UsersRound; count?: number }[] = [
    { value: "descobrir", label: "Descobrir pessoas", icon: UsersRound },
    { value: "conexoes", label: "Minhas conexões", icon: UsersRound, count: counts.friends },
    { value: "solicitacoes", label: "Solicitações", icon: Bell, count: counts.received },
    { value: "sugestoes", label: "Sugestões", icon: UserRoundSearch },
  ];
  return (
    <nav aria-label="Seções de conexões" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {items.map(({ value, label, icon: Icon, count }) => {
          const current = tab === value;
          return (
            <li key={value}>
              <button
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => onChange(value)}
                className={cn(
                  "relative -mb-px inline-flex h-12 items-center gap-2 rounded-t-xl border-b-2 px-4 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500",
                  current ? "border-purple-500 bg-purple-100/70 font-semibold text-purple-700" : "border-transparent text-neutral-700 hover:text-purple-700",
                )}
              >
                <Icon aria-hidden className="size-[18px]" />
                {label}
                {count !== undefined ? (
                  <span className={cn("inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold", current ? "bg-white text-purple-700" : "bg-neutral-100 text-neutral-700")}>{count}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SectionHeader({ title, subtitle, action, first }: { title: string; subtitle: string; action?: ReactNode; first?: boolean }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", first ? "" : "mt-8")}>
      <div>
        <h2 className="text-h3 font-bold text-neutral-900">{title}</h2>
        <p className="mt-0.5 text-body-sm text-neutral-600">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function SeeAll({ onClick, label = "Ver todas" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded text-body-sm font-semibold text-purple-700 hover:underline focus-visible:outline-2 focus-visible:outline-purple-500">
      {label}
    </button>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-neutral-50 px-4 py-6 text-center text-body-sm text-neutral-700">{children}</p>;
}

function TileGrid({ items, render, empty }: { items: ConnectionCard[] | null; render: (card: ConnectionCard) => ReactNode; empty: string }) {
  if (items === null) {
    return (
      <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[270px] rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <EmptyLine>{empty}</EmptyLine>;
  return (
    <div className="@container">
      <ul className="grid grid-cols-2 gap-3 @min-[460px]:grid-cols-3 @min-[620px]:grid-cols-4 @min-[780px]:grid-cols-5">
        {items.map((card) => (
          <li key={card.id}>{render(card)}</li>
        ))}
      </ul>
    </div>
  );
}

function Results({ results, actions, onMore, onClear }: { results: { items: ConnectionCard[]; total: number } | null; actions: PersonActions; onMore: () => void; onClear: () => void }) {
  return (
    <>
      <div className="mb-4 mt-7 flex items-end justify-between gap-4">
        <h2 className="text-h3 font-bold text-neutral-900" aria-live="polite">
          {results === null ? "Buscando…" : `${results.total} ${results.total === 1 ? "pessoa encontrada" : "pessoas encontradas"}`}
        </h2>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded text-body-sm font-semibold text-purple-700 hover:underline focus-visible:outline-2 focus-visible:outline-purple-500">
          <X aria-hidden className="size-4" /> Limpar busca e filtros
        </button>
      </div>
      <TileGrid items={results?.items ?? null} empty="Ninguém encontrado com essa busca. Tente outro nome, cargo ou interesse." render={(card) => <PersonTile card={card} actions={actions} />} />
      {results && results.total > results.items.length ? (
        <div className="mt-5 text-center">
          <Button variant="ghost" onClick={onMore} disabled={results.items.length >= 60}>
            {results.items.length >= 60 ? "Refine a busca para ver mais pessoas" : `Ver mais (${results.total - results.items.length})`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function FriendsTab({ friends, search, onSearch, actions, onFind }: { friends: ConnectionCard[] | null; search: string; onSearch: (v: string) => void; actions: PersonActions; onFind: () => void }) {
  const term = search
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  const visible = (friends ?? []).filter(
    (c) =>
      !term ||
      `${c.name} ${c.position ?? ""} ${c.orgUnit ?? ""}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(term),
  );
  return (
    <>
      <Input type="search" aria-label="Buscar nas minhas conexões" placeholder="Buscar nas minhas conexões..." value={search} onChange={(e) => onSearch(e.target.value)} leading={<Search />} className="h-12 rounded-xl" />
      <SectionHeader title="Minhas conexões" subtitle="Colegas com quem você está conectado: converse, veja o perfil ou desfaça a conexão." />
      {friends !== null && friends.length === 0 ? (
        <div className="rounded-xl bg-neutral-50 px-4 py-8 text-center">
          <p className="text-body-sm text-neutral-700">Você ainda não tem conexões.</p>
          <Button className="mt-3" onClick={onFind}>
            <UserPlus aria-hidden /> Descobrir pessoas
          </Button>
        </div>
      ) : (
        <TileGrid items={friends === null ? null : visible} empty="Ninguém encontrado entre as suas conexões." render={(card) => <PersonTile card={card} actions={actions} menu={<FriendMenu card={card} actions={actions} />} />} />
      )}
    </>
  );
}

function RequestsTab({ requests, actions }: { requests: FriendRequests; actions: PersonActions }) {
  return (
    <>
      <SectionHeader title={`Recebidas (${requests.received.length})`} subtitle="Pessoas que querem se conectar com você." first />
      <TileGrid items={requests.received.map((r) => ({ ...asCard(r.person), relation: "received" as const }))} empty="Nenhum pedido de conexão no momento." render={(card) => <PersonTile card={card} actions={actions} />} />
      <SectionHeader title={`Enviadas (${requests.sent.length})`} subtitle="Pedidos que você enviou e que aguardam resposta." />
      <TileGrid items={requests.sent.map((r) => ({ ...asCard(r.person), relation: "sent" as const }))} empty="Você não tem pedidos aguardando resposta." render={(card) => <PersonTile card={card} actions={actions} />} />
    </>
  );
}

function SideCard({ title, badge, action, children, className }: { title: string; badge?: number; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("card p-5", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-body font-bold text-neutral-900">
          {title}
          {badge ? <span className="inline-flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">{badge}</span> : null}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function RequestsCard({ requests, count, actions, onSeeAll }: { requests: FriendRequests; count: number; actions: PersonActions; onSeeAll: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = (id: string, fn: () => Promise<void>) => async () => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  return (
    <SideCard title="Solicitações de amizade" badge={count} action={<SeeAll onClick={onSeeAll} />}>
      {requests.received.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nenhum pedido pendente. Quando alguém quiser se conectar, aparece aqui.</p>
      ) : (
        <ul className="space-y-4">
          {requests.received.slice(0, 3).map(({ person }) => {
            const card = { ...asCard(person), relation: "received" as const };
            return (
              <li key={person.id} className="flex gap-3">
                <Link href={`/pessoas/${person.id}` as Route} tabIndex={-1} aria-hidden className="shrink-0">
                  <Avatar name={person.name} src={person.image} size="lg" className="size-14 ring-0" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/pessoas/${person.id}` as Route} className="block truncate text-body-sm font-semibold text-neutral-900 hover:text-purple-700">
                    {person.name}
                  </Link>
                  <p className="truncate text-caption text-neutral-600">{person.position ?? "—"}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="flex-1" loading={busy === person.id} onClick={run(person.id, () => actions.accept(card))} aria-label={`Aceitar pedido de ${person.name}`}>
                      Aceitar
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 border-transparent bg-neutral-100" disabled={busy === person.id} onClick={run(person.id, () => actions.dismissRequest(card))} aria-label={`Recusar pedido de ${person.name}`}>
                      Recusar
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SideCard>
  );
}

function OnlineCard({ online, onSeeAll }: { online: { items: ConnectionCard[]; total: number }; onSeeAll: () => void }) {
  return (
    <SideCard title="Pessoas online" action={<SeeAll onClick={onSeeAll} label={`Ver todas (${online.total})`} />}>
      {online.items.length === 0 ? (
        <p className="text-body-sm text-neutral-600">Nenhuma conexão online agora.</p>
      ) : (
        <ul className="space-y-3">
          {online.items.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span className="relative shrink-0">
                <Avatar name={p.name} src={p.image} size="md" className="size-11 ring-0" />
                <span role="img" aria-label="Online agora" className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 ring-2 ring-white" />
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/pessoas/${p.id}` as Route} className="block truncate text-body-sm font-semibold text-neutral-900 hover:text-purple-700">
                  {p.name}
                </Link>
                <span className="block truncate text-caption text-neutral-600">{p.position ?? "—"}</span>
              </span>
              {p.mood ? (
                <span className="flex size-9 items-center justify-center rounded-full bg-purple-50">
                  <MoodMark mood={p.mood} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </SideCard>
  );
}

/** "Meus interesses": as afinidades que alimentam sugestões e o filtro "Mesmos interesses". */
function InterestsCard({ interests, onEdit }: { interests: string[]; onEdit: () => void }) {
  return (
    <section aria-labelledby="meus-interesses" className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-purple-100/60 p-5 shadow-sm">
      <div className="flex gap-4">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white text-purple-600 shadow-sm">
          <Sparkles className="size-7" />
        </span>
        <div>
          <h2 id="meus-interesses" className="text-body font-bold text-neutral-900">
            Meus interesses
          </h2>
          <p className="mt-1 text-body-sm text-neutral-700">Mostram afinidades com colegas e melhoram as sugestões de conexão.</p>
        </div>
      </div>
      {interests.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {interests.map((k) => (
            <li key={k}>
              <InterestChip interest={k} />
            </li>
          ))}
        </ul>
      ) : null}
      <Button size="lg" block variant={interests.length ? "secondary" : "primary"} className="mt-4" onClick={onEdit}>
        <Sparkles aria-hidden /> {interests.length ? "Editar meus interesses" : "Escolher meus interesses"}
      </Button>
    </section>
  );
}

function MoreFiltersDialog({
  open,
  onOpenChange,
  value,
  areas,
  locations,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: MoreFilters;
  areas: Option[];
  locations: Option[];
  onApply: (value: MoreFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(value);
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Mais filtros"
      description="Refine a busca por área, localidade ou interesse."
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => setDraft(NO_MORE)}>
            Limpar
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Aplicar filtros
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Área">
          {({ id }) => (
            <Select id={id} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
              <option value="">Todas as áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Localidade">
          {({ id }) => (
            <Select id={id} value={draft.local} onChange={(e) => setDraft({ ...draft, local: e.target.value })}>
              <option value="">Todas as localidades</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Interesse">
          {({ id }) => (
            <Select id={id} value={draft.interesse} onChange={(e) => setDraft({ ...draft, interesse: e.target.value })}>
              <option value="">Todos os interesses</option>
              {INTERESTS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}
