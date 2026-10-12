"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "@/design-system/components/avatar";
import { Button } from "@/design-system/components/button";
import { Checkbox } from "@/design-system/components/choice";
import { Modal } from "@/design-system/components/dialog";
import { EmojiInput } from "@/design-system/components/emoji-input";
import { Skeleton } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { useToast } from "@/design-system/components/toast";
import { errorMessage, friendsApi } from "./client";
import type { ConversationDetail, PersonCard } from "./types";

const TITLE_MAX = 60;

/** Lista de amigos com busca e seleção múltipla (grupos só reúnem amigos de quem cria ou administra). */
function FriendPicker({ exclude, selected, onChange }: { exclude: string[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [friends, setFriends] = useState<PersonCard[] | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let alive = true;
    friendsApi
      .friends()
      .then((r) => alive && setFriends(r.items))
      .catch(() => alive && setFriends([]));
    return () => {
      alive = false;
    };
  }, []);
  const visible = useMemo(() => {
    const term = search
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
    return (friends ?? []).filter(
      (f) =>
        !exclude.includes(f.id) &&
        (!term ||
          `${f.name} ${f.position ?? ""} ${f.orgUnit ?? ""}`
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .includes(term)),
    );
  }, [friends, exclude, search]);

  if (!friends) {
    return (
      <div aria-hidden className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  const available = friends.filter((f) => !exclude.includes(f.id));
  if (available.length === 0) {
    return <p className="rounded-lg bg-neutral-50 p-4 text-body-sm text-neutral-700">{friends.length === 0 ? "Você ainda não tem amigos para adicionar. Encontre pessoas na aba “Pessoas”." : "Todos os seus amigos já estão no grupo."}</p>;
  }
  return (
    <fieldset>
      <legend className="mb-2 text-body-sm font-medium text-neutral-700">
        Amigos <span className="font-normal text-neutral-600">({selected.length} selecionados)</span>
      </legend>
      <Input type="search" aria-label="Buscar amigos" placeholder="Buscar amigos…" value={search} onChange={(e) => setSearch(e.target.value)} leading={<Search />} />
      <ul className="relative mt-3 max-h-64 space-y-1 overflow-y-auto pr-1">
        {visible.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
            <Avatar name={f.name} src={f.image} size="sm" className="ring-0" />
            <Checkbox
              className="min-w-0 flex-1 flex-row-reverse justify-between"
              checked={selected.includes(f.id)}
              onCheckedChange={(checked) => onChange(checked ? [...selected, f.id] : selected.filter((id) => id !== f.id))}
              label={
                <span className="block min-w-0">
                  <span className="block truncate font-medium text-neutral-900">{f.name}</span>
                  <span className="block truncate text-caption text-neutral-600">{[f.position, f.orgUnit].filter(Boolean).join(" · ")}</span>
                </span>
              }
            />
          </li>
        ))}
        {visible.length === 0 ? <li className="px-2 py-3 text-body-sm text-neutral-600">Nenhum amigo encontrado.</li> : null}
      </ul>
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
    if (members.length === 0) return setError("Escolha ao menos um amigo.");
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
      description="Reúna amigos para conversar e compartilhar ideias."
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
