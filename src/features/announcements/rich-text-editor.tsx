"use client";

import { Bold, FileText, ImageIcon, Italic, Link2, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Field, Input, controlBase, controlState } from "@/design-system/components/field";
import { cn } from "@/design-system/cn";
import { isSafeHref, stripRichText } from "@/lib/rich-text";

type Block = "p" | "h2" | "h3";
const BLOCK_PREFIX: Record<Block, string> = { p: "", h2: "## ", h3: "### " };
const LINE_MARKS = /^(#{2,3}\s+|\s*[-*]\s+|\s*\d+[.)]\s+)/;

/**
 * Editor do texto do comunicado: textarea com barra de formatação que insere a
 * marcação leve de src/lib/rich-text.ts. As edições passam por
 * `execCommand("insertText")`, então desfazer/refazer usam o histórico nativo.
 */
export function RichTextEditor({
  id,
  describedBy,
  invalid,
  value,
  maxLength,
  onChange,
  onAttach,
  disabled,
}: {
  id: string;
  describedBy?: string;
  invalid?: boolean;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  onAttach: (kind: "image" | "file") => void;
  disabled?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [block, setBlock] = useState<Block>("p");
  const [link, setLink] = useState<{ text: string; href: string; error?: string } | null>(null);
  const selection = useRef<[number, number]>([0, 0]);

  /** Troca o trecho [start, end) por `text` e seleciona [selStart, selEnd) dentro dele. */
  function replace(start: number, end: number, text: string, selStart = text.length, selEnd = selStart) {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    const ok = typeof document.execCommand === "function" && document.execCommand("insertText", false, text);
    if (!ok) onChange(el.value.slice(0, start) + text + el.value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start + selStart, start + selEnd));
  }

  function wrap(mark: string, placeholder: string) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = el.value.slice(s, e) || placeholder;
    replace(s, e, `${mark}${selected}${mark}`, mark.length, mark.length + selected.length);
  }

  /** Linhas inteiras que a seleção toca. */
  function selectedLines() {
    const el = area.current!;
    const start = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const nl = el.value.indexOf("\n", el.selectionEnd);
    const end = nl === -1 ? el.value.length : nl;
    return { start, end, lines: el.value.slice(start, end).split("\n") };
  }

  function setLinePrefix(prefix: (index: number) => string, toggleTest?: RegExp) {
    if (!area.current) return;
    const { start, end, lines } = selectedLines();
    const all = toggleTest ? lines.every((l) => toggleTest.test(l)) : false;
    const next = lines.map((l, i) => (all ? l.replace(LINE_MARKS, "") : prefix(i) + l.replace(LINE_MARKS, ""))).join("\n");
    replace(start, end, next);
  }

  function applyBlock(next: Block) {
    setBlock(next);
    setLinePrefix(() => BLOCK_PREFIX[next]);
  }

  function syncBlock() {
    const el = area.current;
    if (!el) return;
    selection.current = [el.selectionStart, el.selectionEnd];
    const line = el.value.slice(el.value.lastIndexOf("\n", el.selectionStart - 1) + 1).split("\n")[0] ?? "";
    setBlock(line.startsWith("### ") ? "h3" : line.startsWith("## ") ? "h2" : "p");
  }

  function clearFormatting() {
    const el = area.current;
    if (!el) return;
    const { start, end } = el.selectionStart === el.selectionEnd ? selectedLines() : { start: el.selectionStart, end: el.selectionEnd };
    replace(start, end, stripRichText(el.value.slice(start, end)));
  }

  function openLink() {
    const el = area.current;
    if (!el) return;
    selection.current = [el.selectionStart, el.selectionEnd];
    setLink({ text: el.value.slice(el.selectionStart, el.selectionEnd), href: "" });
  }

  function insertLink() {
    if (!link) return;
    const href = link.href.trim();
    if (!isSafeHref(href)) return setLink({ ...link, error: "Use um endereço https:// ou uma página da plataforma (ex.: /comunicados)." });
    const text = link.text.trim() || href;
    const [s, e] = selection.current;
    setLink(null);
    requestAnimationFrame(() => replace(s, e, `[${text}](${href})`));
  }

  const history = (command: "undo" | "redo") => {
    area.current?.focus();
    document.execCommand(command);
  };

  const divider = <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />;

  return (
    <div className={cn("overflow-hidden rounded-md border bg-white focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-100", invalid ? "border-red-500" : "border-neutral-200")}>
      <div role="toolbar" aria-label="Formatação do texto" aria-controls={id} className="flex flex-wrap items-center gap-px border-b border-line bg-neutral-50 px-1.5 py-1.5">
        <label htmlFor={`${id}-block`} className="sr-only">
          Estilo do parágrafo
        </label>
        <select
          id={`${id}-block`}
          value={block}
          disabled={disabled}
          onChange={(e) => applyBlock(e.target.value as Block)}
          className="h-7 rounded-md bg-transparent pl-1.5 pr-0.5 text-body-sm text-neutral-800 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500"
        >
          <option value="p">Parágrafo</option>
          <option value="h2">Título</option>
          <option value="h3">Subtítulo</option>
        </select>
        {divider}
        <Tool label="Negrito" icon={Bold} onClick={() => wrap("**", "texto em negrito")} disabled={disabled} />
        <Tool label="Itálico" icon={Italic} onClick={() => wrap("*", "texto em itálico")} disabled={disabled} />
        <Tool label="Sublinhado" icon={Underline} onClick={() => wrap("__", "texto sublinhado")} disabled={disabled} />
        {divider}
        <Tool label="Lista com marcadores" icon={List} onClick={() => setLinePrefix(() => "- ", /^\s*[-*]\s+/)} disabled={disabled} />
        <Tool label="Lista numerada" icon={ListOrdered} onClick={() => setLinePrefix((i) => `${i + 1}. `, /^\s*\d+[.)]\s+/)} disabled={disabled} />
        {divider}
        <Tool label="Inserir link" icon={Link2} onClick={openLink} disabled={disabled} />
        <Tool label="Anexar imagem" icon={ImageIcon} onClick={() => onAttach("image")} disabled={disabled} />
        <Tool label="Anexar arquivo" icon={FileText} onClick={() => onAttach("file")} disabled={disabled} />
        <Tool label="Limpar formatação" icon={RemoveFormatting} onClick={clearFormatting} disabled={disabled} />
        <span className="ml-auto flex items-center gap-0.5">
          <Tool label="Desfazer" icon={Undo2} onClick={() => history("undo")} disabled={disabled} />
          <Tool label="Refazer" icon={Redo2} onClick={() => history("redo")} disabled={disabled} />
        </span>
      </div>
      <textarea
        ref={area}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        value={value}
        maxLength={maxLength}
        rows={12}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onSelect={syncBlock}
        className={cn(controlBase, controlState(false), "block min-h-[240px] resize-y rounded-none border-0 px-3.5 py-3 leading-relaxed focus:ring-0")}
      />

      <Modal
        open={link !== null}
        onOpenChange={(o) => {
          if (!o) setLink(null);
        }}
        title="Inserir link"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLink(null)}>
              Cancelar
            </Button>
            <Button onClick={insertLink}>Inserir</Button>
          </>
        }
      >
        {link ? (
          <div className="space-y-4">
            <Field label="Texto do link">{(f) => <Input id={f.id} value={link.text} onChange={(e) => setLink({ ...link, text: e.target.value })} />}</Field>
            <Field label="Endereço" hint="https://… ou uma página da plataforma, como /comunicados." error={link.error}>
              {(f) => <Input id={f.id} aria-describedby={f.describedBy} invalid={f.invalid} value={link.href} placeholder="https://" onChange={(e) => setLink({ ...link, href: e.target.value, error: undefined })} />}
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Tool({ label, icon: Icon, onClick, disabled }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // Mantém a seleção do texto ao clicar na barra.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 items-center justify-center rounded-md text-neutral-700 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500 disabled:opacity-50"
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}
