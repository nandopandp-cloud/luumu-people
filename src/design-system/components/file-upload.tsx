"use client";

import { AlertCircle, CheckCircle2, CloudUpload, FileText, RotateCw, X } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { cn } from "../cn";

/**
 * Upload de arquivo — styleguide "06. Upload de arquivo": padrão, com arquivo,
 * em progresso, concluído e com erro. Componente de APRESENTAÇÃO: valida tipo
 * e tamanho no navegador para dar retorno rápido, mas o envio e a validação
 * definitiva (bytes reais do arquivo) são responsabilidade do servidor.
 */
export type UploadItem = {
  id: string;
  name: string;
  size: number;
  status: "selected" | "uploading" | "done" | "error";
  progress?: number;
  error?: string;
};

type Props = {
  items: UploadItem[];
  onSelect: (files: File[]) => void;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  /** Extensões/MIME aceitos, ex.: ".pdf,.png,.jpg" */
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
  hint?: string;
  disabled?: boolean;
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((rule) => {
    const r = rule.trim().toLowerCase();
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

export function FileUpload({ items, onSelect, onRemove, onRetry, accept, maxSizeBytes = 10 * 1024 * 1024, multiple, hint, disabled }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  function handle(list: FileList | null) {
    if (!list || disabled) return;
    const files = Array.from(list);
    const invalidType = files.find((f) => !matchesAccept(f, accept));
    const tooBig = files.find((f) => f.size > maxSizeBytes);
    if (invalidType) return setRejection(`O formato de “${invalidType.name}” não é aceito.`);
    if (tooBig) return setRejection(`“${tooBig.name}” passa do limite de ${formatBytes(maxSizeBytes)}.`);
    setRejection(null);
    onSelect(multiple ? files : files.slice(0, 1));
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    handle(event.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-purple-500",
          dragging ? "border-purple-400 bg-purple-50" : "border-neutral-300 bg-neutral-50/60 hover:border-purple-300 hover:bg-purple-50/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <CloudUpload aria-hidden className="size-8 text-neutral-500" />
        <span className="text-body-sm font-medium text-neutral-800">Clique para enviar ou arraste {multiple ? "os arquivos" : "o arquivo"} aqui</span>
        <span className="text-caption text-neutral-500">{hint ?? `Até ${formatBytes(maxSizeBytes)}`}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handle(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {rejection ? (
        <p role="alert" className="flex items-center gap-1.5 text-caption font-medium text-red-600">
          <AlertCircle aria-hidden className="size-3.5" /> {rejection}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="space-y-2" aria-label="Arquivos">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3.5 py-3",
                item.status === "error" ? "border-red-100 bg-red-50" : item.status === "done" ? "border-green-100 bg-green-50" : "border-line bg-white",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", item.status === "error" ? "bg-white text-red-600" : "bg-red-100 text-red-600")}>
                {item.status === "error" ? <AlertCircle aria-hidden className="size-5" /> : <FileText aria-hidden className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm font-medium text-neutral-900">{item.name}</p>
                {item.status === "uploading" ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div role="progressbar" aria-label={`Enviando ${item.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress ?? 0} className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-purple-500 transition-[width]" style={{ width: `${item.progress ?? 0}%` }} />
                    </div>
                    <span className="text-caption tabular-nums text-neutral-500">{item.progress ?? 0}%</span>
                  </div>
                ) : item.status === "done" ? (
                  <p className="flex items-center gap-1 text-caption font-medium text-green-700">
                    <CheckCircle2 aria-hidden className="size-3.5" /> Arquivo enviado com sucesso · {formatBytes(item.size)}
                  </p>
                ) : item.status === "error" ? (
                  <p className="text-caption font-medium text-red-700">{item.error ?? "Falha no envio do arquivo. Tente novamente."}</p>
                ) : (
                  <p className="text-caption text-neutral-500">{formatBytes(item.size)}</p>
                )}
              </div>
              {item.status === "error" && onRetry ? (
                <button type="button" onClick={() => onRetry(item.id)} className="rounded-full p-2 text-red-600 hover:bg-white" aria-label={`Tentar enviar ${item.name} de novo`}>
                  <RotateCw aria-hidden className="size-4" />
                </button>
              ) : null}
              {onRemove ? (
                <button type="button" onClick={() => onRemove(item.id)} className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={`Remover ${item.name}`}>
                  <X aria-hidden className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
