"use client";

import { MoreVertical, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button, IconButton } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert, Skeleton } from "@/design-system/components/feedback";
import { Field, Input, Textarea } from "@/design-system/components/field";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/design-system/components/menu";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { errorMessage, friendsApi } from "@/features/friends/client";
import { chatDock } from "@/features/friends/dock-store";
import { useColleagueSearch } from "@/features/friends/use-colleague-search";
import { api, ApiError } from "@/lib/api-client";
import type { PdiMentor } from "@/server/modules/development/service";
import { SideCard } from "./side-cards";

const NOTE_MAX = 280;

/** Liderança escolhe quem acompanha o ciclo (qualquer colega ativo) e deixa uma mensagem. */
function MentorDialog({ pdiId, personId, mentor, open, onOpenChange }: { pdiId: string; personId: string; mentor: PdiMentor | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(mentor ? { id: mentor.id, name: mentor.name } : null);
  const [note, setNote] = useState(mentor?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { people, pending: searching } = useColleagueSearch(search, open);
  const options = (people ?? []).filter((p) => p.id !== personId);

  function save(mentorUserId: string | null) {
    setError(null);
    startTransition(async () => {
      try {
        await api(`/api/v1/development/pdis/${pdiId}/mentor`, { method: "PUT", body: { mentorUserId, mentorNote: mentorUserId ? note.trim() || null : null } });
        onOpenChange(false);
        router.refresh();
        toast({ tone: "success", title: mentorUserId ? "Mentoria definida!" : "Mentoria removida." });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente novamente.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={mentor ? "Alterar mentoria" : "Definir mentoria"}
      description="Quem acompanha este ciclo do PDI e uma mensagem para a pessoa."
      footer={
        <>
          {mentor ? (
            <Button variant="ghost" className="mr-auto" disabled={pending} onClick={() => save(null)}>
              Remover mentoria
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button loading={pending} disabled={!chosen} onClick={() => chosen && save(chosen.id)}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert tone="error" title={error} /> : null}
        <fieldset>
          <legend className="mb-2 text-body-sm font-medium text-neutral-700">
            Mentoria {chosen ? <span className="font-normal text-neutral-600">— {chosen.name}</span> : null}
          </legend>
          <Input type="search" aria-label="Buscar colaboradores" placeholder="Buscar por nome, cargo ou área…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} />
          {people === null ? (
            <div aria-hidden className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ul aria-busy={searching} className={cn("relative mt-3 max-h-56 space-y-1 overflow-y-auto pr-1", searching && "opacity-60")}>
              {options.map((p) => {
                const selected = chosen?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setChosen({ id: p.id, name: p.name })}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-purple-500",
                        selected ? "bg-purple-100 ring-1 ring-purple-300" : "hover:bg-purple-50",
                      )}
                    >
                      <Avatar name={p.name} src={p.image} size="sm" className="ring-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-medium text-neutral-900">{p.name}</span>
                        <span className="block truncate text-caption text-neutral-600">{[p.position, p.orgUnit].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {options.length === 0 && !searching ? <li className="px-2 py-3 text-body-sm text-neutral-600">Ninguém encontrado na empresa.</li> : null}
            </ul>
          )}
        </fieldset>
        <Field label="Mensagem para a pessoa (opcional)" hint={`${note.length}/${NOTE_MAX}`}>
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX} rows={3} />}
        </Field>
      </div>
    </Modal>
  );
}

/** "Minha mentoria": quem acompanha o ciclo, atalho para conversar e a mensagem deixada. */
export function MentorshipCard({ pdiId, personId, mentor, isSelf, canManage }: { pdiId: string; personId: string; mentor: PdiMentor | null; isSelf: boolean; canManage: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [opening, setOpening] = useState(false);

  async function talk() {
    if (!mentor) return;
    setOpening(true);
    try {
      const { id } = await friendsApi.open({ kind: "direct", userId: mentor.id });
      chatDock.open(id);
    } catch (error) {
      toast({ tone: "error", title: "Não foi possível abrir a conversa.", description: errorMessage(error) });
    } finally {
      setOpening(false);
    }
  }

  return (
    <SideCard id="mentoria" title={isSelf ? "Minha mentoria" : "Mentoria"} className="@container">
      {mentor ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Avatar name={mentor.name} src={mentor.image} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold text-neutral-900">{mentor.name}</p>
              <p className="text-caption text-neutral-600">{mentor.active ? (mentor.position ?? "—") : "Não está mais na empresa"}</p>
            </div>
            {mentor.active ? (
              <Button variant="secondary" size="sm" loading={opening} onClick={() => void talk()} className="order-last w-full @[24rem]:order-none @[24rem]:w-auto">
                {isSelf ? "Agendar conversa" : "Conversar"}
                <span className="sr-only"> com {mentor.name}</span>
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Opções da mentoria" variant="plain" size="sm" className="text-neutral-600">
                  <MoreVertical />
                </IconButton>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem asChild>
                  <Link href={`/pessoas/${mentor.id}` as Route}>Ver perfil</Link>
                </MenuItem>
                {canManage ? (
                  <>
                    <MenuSeparator />
                    <MenuItem onSelect={() => setEditing(true)}>Alterar mentoria</MenuItem>
                  </>
                ) : null}
              </MenuContent>
            </Menu>
          </div>
          {mentor.note ? (
            <figure className="mt-4 rounded-lg bg-purple-50 px-4 py-3">
              <blockquote className="text-body-sm italic leading-relaxed text-purple-700">“{mentor.note}”</blockquote>
              <figcaption className="mt-1.5 text-caption text-purple-700">— {mentor.name}</figcaption>
            </figure>
          ) : null}
        </>
      ) : (
        <div>
          <p className="text-body-sm text-neutral-600">{isSelf ? "Sua liderança ainda não definiu uma mentoria para este ciclo." : "Nenhuma mentoria definida para este ciclo."}</p>
          {canManage ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(true)}>
              <UserPlus aria-hidden /> Definir mentoria
            </Button>
          ) : null}
        </div>
      )}
      {canManage && editing ? <MentorDialog pdiId={pdiId} personId={personId} mentor={mentor} open={editing} onOpenChange={setEditing} /> : null}
    </SideCard>
  );
}
