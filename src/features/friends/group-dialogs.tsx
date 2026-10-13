"use client";

import { Search } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { Checkbox } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { EmojiInput } from "@/design-system/components/emoji-input";
import { Skeleton } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { useToast } from "@/design-system/components/toast";
import { cn } from "@/design-system/cn";
import { errorMessage, friendsApi } from "./client";
import type { ConversationDetail, PersonCard } from "./types";
import { useColleagueSearch } from "./use-colleague-search";

const TITLE_MAX = 60;

/** Colegas da empresa com busca e seleção múltipla; quem já foi escolhido fica no topo. */
function FriendPicker({ exclude, selected, onChange }: { exclude: string[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<PersonCard[]>([]);
  const { people, pending } = useColleagueSearch(search);
  const picked = chosen.filter((p) => selected.includes(p.id));
  const visible = [...picked, ...(people ?? []).filter((p) => !exclude.includes(p.id) && !selected.includes(p.id))];

  function toggle(person: PersonCard, checked: boolean) {
    if (checked) {
      setChosen((list) => [...list.filter((p) => p.id !== person.id), person]);
      onChange([...selected, person.id]);
    } else {
      onChange(selected.filter((id) => id !== person.id));
    }
  }

  return (
    <fieldset>
      <legend className="mb-2 text-body-sm font-medium text-neutral-700">
        Pessoas <span className="font-normal text-neutral-600">({selected.length} selecionadas)</span>
      </legend>
      <Input type="search" aria-label="Buscar colaboradores" placeholder="Buscar por nome, cargo ou área…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} />
      {people === null ? (
        <div aria-hidden className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ul aria-busy={pending} className={cn("relative mt-3 max-h-64 space-y-1 overflow-y-auto pr-1 transition-opacity", pending && "opacity-60")}>
          {visible.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
              <Avatar name={f.name} src={f.image} size="sm" className="ring-0" />
              <Checkbox
                className="min-w-0 flex-1 flex-row-reverse justify-between"
                checked={selected.includes(f.id)}
                onCheckedChange={(checked) => toggle(f, checked === true)}
                label={
                  <span className="block min-w-0">
                    <span className="block truncate font-medium text-neutral-900">{f.name}</span>
                    <span className="block truncate text-caption text-neutral-600">{[f.position, f.orgUnit].filter(Boolean).join(" · ")}</span>
                  </span>
                }
              />
            </li>
          ))}
          {visible.length === 0 && !pending ? <li className="px-2 py-3 text-body-sm text-neutral-600">Ninguém encontrado na empresa.</li> : null}
        </ul>
      )}
    </fieldset>
  );
}

export function NewGroupDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Dê um nome ao grupo.");
    if (members.length === 0) return setError("Escolha ao menos uma pessoa.");
    setSaving(true);
    try {
      const { id } = await friendsApi.open({ kind: "group", title: title.trim(), memberIds: members });
      toast({ tone: "success", title: "Grupo criado!" });
      setTitle("");
      setMembers([]);
      setError(null);
      onOpenChange(false);
      onCreated(id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Nova conversa em grupo"
      description="Reúna colegas para conversar e compartilhar ideias."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="novo-grupo" loading={saving}>
            Criar grupo
          </Button>
        </>
      }
    >
      <form id="novo-grupo" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Nome do grupo" error={error && !title.trim() ? error : undefined}>
          {({ id, describedBy, invalid }) => <EmojiInput id={id} aria-describedby={describedBy} invalid={invalid} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Time Produto" />}
        </Field>
        <FriendPicker exclude={[]} selected={members} onChange={setMembers} />
        {error && title.trim() ? (
          <p role="alert" className="text-body-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

export function AddMembersDialog({ detail, open, onOpenChange, onDone }: { detail: ConversationDetail; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const toast = useToast();
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (members.length === 0) return;
    setSaving(true);
    try {
      await friendsApi.addMembers(detail.id, members);
      toast({ tone: "success", title: members.length === 1 ? "Pessoa adicionada ao grupo." : "Pessoas adicionadas ao grupo." });
      setMembers([]);
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast({ tone: "error", title: "Não foi possível adicionar.", description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Adicionar a “${detail.title}”`}
      description="Quem entrar agora vê as mensagens a partir de hoje."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving} disabled={members.length === 0}>
            Adicionar
          </Button>
        </>
      }
    >
      <FriendPicker exclude={detail.members.map((m) => m.id)} selected={members} onChange={setMembers} />
    </Modal>
  );
}

export function RenameGroupDialog({ detail, open, onOpenChange, onDone }: { detail: ConversationDetail; open: boolean; onOpenChange: (open: boolean) => void; onDone: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(detail.title);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await friendsApi.rename(detail.id, title.trim());
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast({ tone: "error", title: "Não foi possível renomear.", description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Renomear grupo"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="renomear-grupo" loading={saving} disabled={!title.trim()}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="renomear-grupo" onSubmit={submit}>
        <Field label="Nome do grupo">{({ id }) => <EmojiInput id={id} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} />}</Field>
      </form>
    </Modal>
  );
}

/** Confirmação de ação destrutiva (sair do grupo, remover pessoa, desfazer amizade). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirm,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirm: string;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm}
          </Button>
        </>
      }
    />
  );
}
