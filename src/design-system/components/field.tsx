import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../cn";

/**
 * Campos de formulário — styleguide "01. Inputs de texto" / "03. Textarea".
 * Estados: padrão, foco, preenchido, erro, sucesso, desabilitado.
 * Acessibilidade: label sempre associado; erro e ajuda ligados por aria-describedby;
 * erro anunciado (role="alert") e indicado também por ícone (não só cor).
 */

type FieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  success?: string | null;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function Field({ label, hint, error, success, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-sm font-medium text-neutral-700">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error ? (
        <p id={hintId} className="text-caption text-neutral-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-caption font-medium text-red-600">
          <AlertCircle aria-hidden className="size-3.5" />
          {error}
        </p>
      ) : null}
      {success && !error ? (
        <p className="flex items-center gap-1 text-caption font-medium text-green-700">
          <CheckCircle2 aria-hidden className="size-3.5" />
          {success}
        </p>
      ) : null}
    </div>
  );
}

export const controlBase =
  "w-full rounded-md border bg-white text-body-sm text-neutral-900 placeholder:text-neutral-400 transition-[border-color,box-shadow] duration-150 focus:outline-none focus-visible:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400";

export function controlState(invalid?: boolean) {
  return invalid ? "border-red-500 focus:border-red-500 focus:ring-red-100" : "border-neutral-200 hover:border-neutral-300";
}

type InputProps = ComponentProps<"input"> & {
  invalid?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function Input({ className, invalid, leading, trailing, ...props }: InputProps) {
  return (
    <div className="relative flex items-center">
      {leading ? <span className="pointer-events-none absolute left-3.5 text-neutral-400 [&_svg]:size-[18px]">{leading}</span> : null}
      <input
        aria-invalid={invalid || undefined}
        className={cn(controlBase, controlState(invalid), "h-11 px-3.5", leading && "pl-10", trailing && "pr-11", className)}
        {...props}
      />
      {trailing ? <span className="absolute right-2 flex items-center">{trailing}</span> : null}
    </div>
  );
}

export function Textarea({ className, invalid, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cn(controlBase, controlState(invalid), "min-h-24 resize-y px-3.5 py-3", className)} {...props} />;
}
