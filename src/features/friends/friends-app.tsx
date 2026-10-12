"use client";

import { MessageCirclePlus, Search, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AvatarGroup } from "@/design-system/components/avatar";
import { Mascot } from "@/design-system/components/brand";
import { Button, IconButton } from "@/design-system/components/button";
import { Drawer } from "@/design-system/components/dialog";
import { Skeleton } from "@/design-system/components/feedback";
import { Input } from "@/design-system/components/field";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { ChatPanel } from "./chat-panel";
import { errorMessage, friendsApi } from "./client";
import { AddMembersDialog, ConfirmDialog, NewGroupDialog, RenameGroupDialog } from "./group-dialogs";
import { MoodMark, PresenceAvatar, shortWhen } from "./person-bits";
import { GroupPanel, PersonPanel, RelationActions, type FriendActions } from "./profile-panel";
import type { ConversationDetail, ConversationSummary, FriendRequest, FriendRequests, MessagesPage, PersonCard } from "./types";

export type FriendsTab = "conversas" | "pessoas" | "solicitacoes";
type Filter = "todas" | "nao-lidas" | "grupos";

const LIST_POLL_MS = 10_000;
const PEOPLE_PAGE = 24;

type Initial = {
  conversations: ConversationSummary[];
  requests: FriendRequests;
  detail: ConversationDetail | null;
  messages: MessagesPage | null;
};

/** Desktop largo (três colunas): o painel do perfil fica ao lado; abaixo disso, numa gaveta. */
function useWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

function setUrl(params: { conversa?: string | null; aba?: FriendsTab; pessoa?: string | null }, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (value === null || value === "conversas") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history[push ? "pushState" : "replaceState"](null, "", `${url.pathname}${url.search}`);
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function FriendsApp({ meId, initial }: { meId: string; initial: Initial }) {
  const toast = useToast();
  const params = useSearchParams();
  const wide = useWide();
  const tab = (["pessoas", "solicitacoes"].includes(params.get("aba") ?? "") ? params.get("aba") : "conversas") as FriendsTab;
  const activeId = params.get("conversa");
  const personId = params.get("pessoa");

  const [conversations, setConversations] = useState(initial.conversations);
  const [requests, setRequests] = useState(initial.requests);
  const [loaded, setDetail] = useState<ConversationDetail | null>(initial.detail);
  // Detalhe da conversa aberta na URL (o carregado pode ser de outra, até a troca terminar).
  const detail = activeId && loaded?.id === activeId ? loaded : null;
  const [panelOpen, setPanelOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newGroup, setNewGroup] = useState(false);
  const [addMembers, setAddMembers] = useState(false);
  const [rename, setRename] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; description: string; label: string; run: () => Promise<void> } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const [peopleVersion, setPeopleVersion] = useState(0);

  const refreshList = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([friendsApi.conversations(), friendsApi.requests()]);
      setConversations(c.items);
      setRequests(r);
    } catch {
      /* silencioso: a lista volta no próximo ciclo */
    }
  }, []);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        setDetail(await friendsApi.detail(id));
      } catch (error) {
        setDetail(null);
        setUrl({ conversa: null });
        toast({ tone: "error", title: "Conversa indisponível.", description: errorMessage(error) });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!activeId || loaded?.id === activeId) return;
    let alive = true;
    friendsApi
      .detail(activeId)
      .then((d) => alive && setDetail(d))
      .catch((error) => {
        if (!alive) return;
        setUrl({ conversa: null });
        toast({ tone: "error", title: "Conversa indisponível.", description: errorMessage(error) });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega só quando a conversa muda
  }, [activeId]);

  // Lista e pedidos: atualização periódica e ao voltar para a janela.
  useEffect(() => {
    const timer = window.setInterval(() => document.visibilityState === "visible" && void refreshList(), LIST_POLL_MS);
    window.addEventListener("focus", refreshList);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshList);
    };
  }, [refreshList]);

  const openConversation = useCallback((id: string) => {
    setUrl({ conversa: id, pessoa: null }, true);
    setDrawerOpen(false);
  }, []);

  const afterRelationChange = useCallback(async () => {
    setProfileVersion((v) => v + 1);
    setPeopleVersion((v) => v + 1);
    await refreshList();
    if (activeId) await loadDetail(activeId);
  }, [refreshList, loadDetail, activeId]);

  const actions: FriendActions = useMemo(
    () => ({
      async request(userId) {
        try {
          const { relation } = await friendsApi.request(userId);
          toast({ tone: "success", title: relation === "friends" ? "Agora vocês são amigos! 💜" : "Pedido de amizade enviado." });
          await afterRelationChange();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível enviar o pedido.", description: errorMessage(error) });
        }
      },
      async accept(userId) {
        try {
          await friendsApi.accept(userId);
          toast({ tone: "success", title: "Agora vocês são amigos! 💜" });
          await afterRelationChange();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível aceitar o pedido.", description: errorMessage(error) });
        }
      },
      async dismiss(userId) {
        try {
          await friendsApi.dismiss(userId);
          await afterRelationChange();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível atualizar o pedido.", description: errorMessage(error) });
        }
      },
      unfriend(userId) {
        setConfirm({
          title: "Desfazer amizade?",
          description: "A conversa de vocês fica no histórico, mas ninguém poderá enviar novas mensagens até que voltem a ser amigos.",
          label: "Desfazer amizade",
          run: async () => {
            try {
              await friendsApi.unfriend(userId);
              toast({ tone: "success", title: "Amizade desfeita." });
              await afterRelationChange();
            } catch (error) {
              toast({ tone: "error", title: "Não foi possível desfazer a amizade.", description: errorMessage(error) });
            }
          },
        });
      },
      async message(userId) {
        try {
          const { id } = await friendsApi.open({ kind: "direct", userId });
          await refreshList();
          setUrl({ aba: "conversas", conversa: id, pessoa: null }, true);
          setDrawerOpen(false);
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
        }
      },
      openConversation,
    }),
    [toast, afterRelationChange, refreshList, openConversation],
  );

  const onRead = useCallback((id: string) => setConversations((list) => list.map((c) => (c.id === id ? { ...c, unread: 0 } : c))), []);
  const leave = useCallback(() => {
    if (!detail) return;
    const id = detail.id;
    setConfirm({
      title: `Sair de “${detail.title}”?`,
      description: "Você deixa de ver as mensagens do grupo. Para voltar, alguém da administração precisa adicionar você de novo.",
      label: "Sair do grupo",
      run: async () => {
        try {
          await friendsApi.removeMember(id, meId);
          toast({ tone: "success", title: "Você saiu do grupo." });
          setUrl({ conversa: null }, true);
          await refreshList();
        } catch (error) {
          toast({ tone: "error", title: "Não foi possível sair do grupo.", description: errorMessage(error) });
        }
      },
    });
  }, [detail, meId, refreshList, toast]);

  const removeMember = useCallback(
    (userId: string, name: string) => {
      if (!detail) return;
      const id = detail.id;
      setConfirm({
        title: `Remover ${name.split(" ")[0]} do grupo?`,
        description: "A pessoa deixa de ver as mensagens do grupo.",
        label: "Remover",
        run: async () => {
          try {
            await friendsApi.removeMember(id, userId);
            await loadDetail(id);
            await refreshList();
          } catch (error) {
            toast({ tone: "error", title: "Não foi possível remover.", description: errorMessage(error) });
          }
        },
      });
    },
    [detail, loadDetail, refreshList, toast],
  );

  const changeTab = (next: FriendsTab) => setUrl({ aba: next, pessoa: null });
  const selectPerson = (userId: string) => {
    setUrl({ pessoa: userId, conversa: null });
    if (!wide) setDrawerOpen(true);
  };
  const togglePanel = () => (wide ? setPanelOpen((open) => !open) : setDrawerOpen(true));

  const unreadConversations = conversations.filter((c) => c.unread > 0).length;
  const showPanel = wide && panelOpen && (detail || (personId && !activeId));
  const panelContent = detail ? (
    detail.kind === "group" ? (
      <GroupPanel
        detail={detail}
        meId={meId}
        onClose={wide ? () => setPanelOpen(false) : undefined}
        onAddMembers={() => setAddMembers(true)}
        onRename={() => setRename(true)}
        onRemove={removeMember}
        onLeave={leave}
      />
    ) : detail.otherId ? (
      <PersonPanel userId={detail.otherId} conversationId={detail.id} actions={actions} onClose={wide ? () => setPanelOpen(false) : undefined} version={profileVersion} />
    ) : null
  ) : personId ? (
    <PersonPanel userId={personId} actions={actions} onClose={wide ? () => setUrl({ pessoa: null }) : undefined} version={profileVersion} />
  ) : null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 lg:h-[calc(100dvh-7.75rem)] lg:min-h-[560px] [&>*]:min-w-0",
        "lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]",
        showPanel && "xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(300px,350px)]",
      )}
    >
      {/* Coluna da esquerda: no celular some quando há uma conversa aberta. */}
      <section aria-labelledby="amigos-titulo" className={cn("card flex min-h-0 flex-col overflow-hidden p-0 max-lg:min-h-[70dvh]", activeId && "max-lg:hidden")}>
        <header className="flex items-center justify-between gap-3 px-5 pb-1 pt-6 sm:px-6">
          <h1 id="amigos-titulo" className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">
            Amigos
          </h1>
          <IconButton label="Nova conversa em grupo" variant="soft" size="lg" onClick={() => setNewGroup(true)}>
            <UsersRound />
          </IconButton>
        </header>
        <div role="tablist" aria-label="Seções de amigos" className="mt-3 flex gap-1 border-b border-line px-3 sm:px-4">
          {(
            [
              { value: "conversas", label: "Conversas" },
              { value: "pessoas", label: "Pessoas" },
              { value: "solicitacoes", label: "Solicitações", count: requests.received.length },
            ] as { value: FriendsTab; label: string; count?: number }[]
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`aba-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`painel-${t.value}`}
              onClick={() => changeTab(t.value)}
              className={cn(
                "relative -mb-px inline-flex items-center gap-1.5 rounded-t-lg px-3.5 py-3 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500",
                tab === t.value ? "border-b-2 border-purple-500 bg-purple-50 font-semibold text-purple-700" : "border-b-2 border-transparent text-neutral-700 hover:text-purple-700",
              )}
            >
              {t.label}
              {t.count ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {t.count}
                  <span className="sr-only"> {t.count === 1 ? "pedido novo" : "pedidos novos"}</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div id={`painel-${tab}`} role="tabpanel" aria-labelledby={`aba-${tab}`} className="flex min-h-0 flex-1 flex-col">
          {tab === "conversas" ? <ConversationsTab conversations={conversations} activeId={activeId} unread={unreadConversations} onOpen={openConversation} onFindPeople={() => changeTab("pessoas")} /> : null}
          {tab === "pessoas" ? <PeopleTab selectedId={personId} onSelect={selectPerson} actions={actions} version={peopleVersion} /> : null}
          {tab === "solicitacoes" ? <RequestsTab requests={requests} selectedId={personId} onSelect={selectPerson} actions={actions} /> : null}
        </div>
      </section>

      {/* Conversa */}
      <div className={cn("min-h-0 max-lg:h-[calc(100dvh-15rem)] max-lg:min-h-[420px]", !activeId && "max-lg:hidden")}>
        {activeId && detail ? (
          <ChatPanel
            key={detail.id}
            detail={detail}
            meId={meId}
            initial={initial.detail?.id === detail.id ? initial.messages : null}
            panelOpen={Boolean(showPanel)}
            onTogglePanel={togglePanel}
            onBack={() => setUrl({ conversa: null }, true)}
            onRead={onRead}
            onActivity={refreshList}
            onAddMembers={() => setAddMembers(true)}
            onRename={() => setRename(true)}
            onLeave={leave}
            onUnfriend={actions.unfriend}
            onRequestFriend={(userId) => void actions.request(userId)}
          />
        ) : activeId ? (
          <div className="card flex h-full min-h-[60dvh] items-center justify-center p-0" aria-busy="true">
            <Skeleton className="h-10 w-48" />
          </div>
        ) : (
          <NoConversation onNewGroup={() => setNewGroup(true)} onFindPeople={() => changeTab("pessoas")} />
        )}
      </div>

      {/* Perfil ou detalhes do grupo */}
      {showPanel ? (
        <aside aria-label={detail?.kind === "group" ? "Detalhes do grupo" : "Perfil"} className="card hidden min-h-0 overflow-y-auto p-0 xl:block">
          {panelContent}
        </aside>
      ) : null}
      {!wide ? (
        <Drawer open={drawerOpen && Boolean(panelContent)} onOpenChange={setDrawerOpen} title={detail?.kind === "group" ? "Detalhes do grupo" : "Perfil"}>
          <div className="-mx-6 -my-5">{panelContent}</div>
        </Drawer>
      ) : null}

      <NewGroupDialog
        open={newGroup}
        onOpenChange={setNewGroup}
        onCreated={async (id) => {
          await refreshList();
          setUrl({ aba: "conversas", conversa: id }, true);
        }}
      />
      {detail?.kind === "group" ? (
        <>
          <AddMembersDialog
            detail={detail}
            open={addMembers}
            onOpenChange={setAddMembers}
            onDone={() => {
              void loadDetail(detail.id);
              void refreshList();
            }}
          />
          <RenameGroupDialog
            key={`${detail.id}-${detail.title}`}
            detail={detail}
            open={rename}
            onOpenChange={setRename}
            onDone={() => {
              void loadDetail(detail.id);
              void refreshList();
            }}
          />
        </>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirm={confirm?.label ?? "Confirmar"}
        onConfirm={async () => {
          await confirm?.run();
        }}
      />
    </div>
  );
}

function NoConversation({ onNewGroup, onFindPeople }: { onNewGroup: () => void; onFindPeople: () => void }) {
  return (
    <section aria-label="Nenhuma conversa aberta" className="card flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="relative mb-3">
        <div aria-hidden className="absolute inset-x-0 bottom-0 mx-auto h-1/3 w-4/5 rounded-full bg-purple-100 blur-xl" />
        <Mascot className="relative h-28" />
      </div>
      <p className="text-h3 font-bold text-neutral-900">Conecte-se e compartilhe ideias com seu time! 💜</p>
      <p className="mt-2 max-w-sm text-body-sm text-neutral-600">Escolha uma conversa ao lado, encontre colegas para adicionar como amigos ou crie um grupo.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Button onClick={onFindPeople}>Encontrar pessoas</Button>
        <Button variant="secondary" onClick={onNewGroup}>
          <MessageCirclePlus aria-hidden /> Novo grupo
        </Button>
      </div>
    </section>
  );
}

function SearchBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="px-5 pt-4 sm:px-6">
      <Input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} leading={<Search />} className="rounded-full" />
    </div>
  );
}

function ConversationsTab({ conversations, activeId, unread, onOpen, onFindPeople }: { conversations: ConversationSummary[]; activeId: string | null; unread: number; onOpen: (id: string) => void; onFindPeople: () => void }) {
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const visible = conversations.filter((c) => {
    if (filter === "nao-lidas" && c.unread === 0) return false;
    if (filter === "grupos" && c.kind !== "group") return false;
    const term = normalize(search);
    return !term || normalize(`${c.title} ${c.members.map((m) => m.name).join(" ")}`).includes(term);
  });
  return (
    <>
      <SearchBox label="Buscar conversas" placeholder="Buscar conversas…" value={search} onChange={setSearch} />
      <div className="flex gap-2 px-5 pb-2 pt-3 sm:px-6" role="group" aria-label="Filtrar conversas">
        {(
          [
            { value: "todas", label: "Todas" },
            { value: "nao-lidas", label: "Não lidas", count: unread },
            { value: "grupos", label: "Grupos" },
          ] as { value: Filter; label: string; count?: number }[]
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500",
              filter === f.value ? "bg-purple-500 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-purple-50 hover:text-purple-700",
            )}
          >
            {f.label}
            {f.count ? <span className={cn("inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold", filter === f.value ? "bg-white text-purple-700" : "bg-red-500 text-white")}>{f.count}</span> : null}
          </button>
        ))}
      </div>
      <ul aria-label="Conversas" className="min-h-0 flex-1 overflow-y-auto pb-3">
        {visible.map((c) => (
          <li key={c.id}>
            <ConversationRow conversation={c} active={c.id === activeId} onOpen={onOpen} />
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="px-6 py-10 text-center">
            <p className="text-body-sm font-semibold text-neutral-900">{conversations.length === 0 ? "Nenhuma conversa ainda" : "Nenhuma conversa encontrada"}</p>
            <p className="mt-1 text-body-sm text-neutral-600">{conversations.length === 0 ? "Adicione amigos para começar a conversar." : "Ajuste a busca ou os filtros."}</p>
            {conversations.length === 0 ? (
              <Button variant="soft" size="sm" className="mt-3" onClick={onFindPeople}>
                Encontrar pessoas
              </Button>
            ) : null}
          </li>
        ) : null}
      </ul>
    </>
  );
}

function ConversationRow({ conversation: c, active, onOpen }: { conversation: ConversationSummary; active: boolean; onOpen: (id: string) => void }) {
  const preview = c.lastMessage ? (c.lastMessage.mine ? `Você: ${c.lastMessage.preview}` : c.kind === "group" ? `${c.lastMessage.senderName}: ${c.lastMessage.preview}` : c.lastMessage.preview) : c.kind === "group" ? "Grupo criado" : "Comece a conversa";
  return (
    <button
      type="button"
      onClick={() => onOpen(c.id)}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500 sm:px-6",
        active ? "bg-purple-50" : "hover:bg-neutral-50",
      )}
    >
      {c.kind === "group" ? (
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600">
          <UsersRound className="size-6" />
        </span>
      ) : (
        <PresenceAvatar name={c.title} image={c.image} online={c.other?.online} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="truncate text-body font-semibold text-neutral-900">{c.title}</span>
            {c.kind === "direct" && c.other ? <MoodMark mood={c.other.mood} inline /> : null}
            {c.kind === "group" && c.members.length ? (
              <span aria-hidden className="shrink-0">
                <AvatarGroup people={c.members.map((m) => ({ name: m.name, src: m.image }))} max={3} size="xs" />
              </span>
            ) : null}
          </span>
          <span className={cn("shrink-0 text-caption", c.unread ? "font-semibold text-purple-700" : "text-neutral-600")}>{c.lastMessage ? shortWhen(c.lastMessage.at) : ""}</span>
        </span>
        <span className="mt-0.5 flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-body-sm", c.unread ? "font-medium text-neutral-900" : "text-neutral-600")}>{preview}</span>
          {c.unread ? (
            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-500 text-caption font-bold text-white">
              {c.unread > 9 ? "9+" : c.unread}
              <span className="sr-only"> {c.unread === 1 ? "mensagem não lida" : "mensagens não lidas"}</span>
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function PersonRow({ person, selected, onSelect, actions }: { person: PersonCard; selected: boolean; onSelect: (id: string) => void; actions: FriendActions }) {
  return (
    <div className={cn("flex items-center gap-3 px-5 py-3 sm:px-6", selected ? "bg-purple-50" : "hover:bg-neutral-50")}>
      <button type="button" onClick={() => onSelect(person.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500">
        <PresenceAvatar name={person.name} image={person.image} online={person.online} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-body-sm font-semibold text-neutral-900">{person.name}</span>
            {person.relation === "friends" ? <span className="sr-only">(amigo)</span> : null}
            <MoodMark mood={person.mood} inline className="size-5" />
          </span>
          <span className="block truncate text-caption text-neutral-600">{[person.position, person.orgUnit].filter(Boolean).join(" · ") || "—"}</span>
          {person.mutualCount > 0 && person.relation !== "friends" ? (
            <span className="block text-caption text-purple-700">
              {person.mutualCount} {person.mutualCount === 1 ? "amigo em comum" : "amigos em comum"}
            </span>
          ) : null}
        </span>
      </button>
      <div className="shrink-0">
        <RelationActions person={person} actions={actions} size="sm" compact />
      </div>
    </div>
  );
}

function PeopleTab({ selectedId, onSelect, actions, version }: { selectedId: string | null; onSelect: (id: string) => void; actions: FriendActions; version: number }) {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PEOPLE_PAGE);
  const [data, setData] = useState<{ items: PersonCard[]; total: number } | null>(null);
  const [error, setError] = useState(false);
  const lastQuery = useRef("");

  useEffect(() => {
    let alive = true;
    const term = search.trim();
    const timer = window.setTimeout(
      () => {
        friendsApi
          .people(term, limit)
          .then((r) => {
            if (!alive) return;
            lastQuery.current = term;
            setData(r);
            setError(false);
          })
          .catch(() => alive && setError(true));
      },
      term === lastQuery.current ? 0 : 300,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search, limit, version]);

  const friends = data?.items.filter((p) => p.relation === "friends") ?? [];
  const others = data?.items.filter((p) => p.relation !== "friends") ?? [];
  return (
    <>
      <SearchBox
        label="Buscar pessoas"
        placeholder="Buscar por nome, cargo ou área…"
        value={search}
        onChange={(v) => {
          setSearch(v);
          setLimit(PEOPLE_PAGE);
        }}
      />
      <div className="min-h-0 flex-1 overflow-y-auto py-3" aria-busy={!data}>
        {error ? <p className="px-6 py-6 text-body-sm text-neutral-600">Não foi possível carregar as pessoas. Tente novamente.</p> : null}
        {!data && !error ? (
          <div aria-hidden className="space-y-3 px-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : null}
        {data && data.items.length === 0 ? <p className="px-6 py-6 text-body-sm text-neutral-600">Ninguém encontrado com “{search.trim()}”.</p> : null}
        {[
          { title: "Seus amigos", list: friends },
          { title: search.trim() ? "Outras pessoas" : "Pessoas da empresa", list: others },
        ].map((group) =>
          group.list.length ? (
            <section key={group.title} aria-label={group.title} className="mb-2">
              <h2 className="px-6 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-600">{group.title}</h2>
              <ul>
                {group.list.map((p) => (
                  <li key={p.id}>
                    <PersonRow person={p} selected={p.id === selectedId} onSelect={onSelect} actions={actions} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        {data && data.total > data.items.length ? (
          <div className="px-6 pt-2 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit((l) => Math.min(60, l + PEOPLE_PAGE))} disabled={limit >= 60}>
              {limit >= 60 ? "Refine a busca para ver mais pessoas" : `Ver mais (${data.total - data.items.length})`}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function RequestsTab({ requests, selectedId, onSelect, actions }: { requests: FriendRequests; selectedId: string | null; onSelect: (id: string) => void; actions: FriendActions }) {
  const section = (title: string, list: FriendRequest[], empty: string) => (
    <section aria-label={title} className="mb-3">
      <h2 className="px-6 pb-1 pt-2 text-caption font-semibold uppercase tracking-wide text-neutral-600">
        {title} ({list.length})
      </h2>
      {list.length ? (
        <ul>
          {list.map((r) => (
            <li key={r.person.id}>
              <PersonRow person={r.person} selected={r.person.id === selectedId} onSelect={onSelect} actions={actions} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-2 text-body-sm text-neutral-600">{empty}</p>
      )}
    </section>
  );
  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-3">
      {section("Recebidas", requests.received, "Nenhum pedido de amizade no momento.")}
      {section("Enviadas", requests.sent, "Você não tem pedidos aguardando resposta.")}
    </div>
  );
}

export function FriendsSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 lg:h-[calc(100dvh-7.75rem)] lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)_minmax(300px,350px)]">
      <div className="card space-y-4 p-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="hidden rounded-xl lg:block" />
      <Skeleton className="hidden rounded-xl xl:block" />
    </div>
  );
}
