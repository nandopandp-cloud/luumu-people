"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../cn";

/** Modal e Drawer — Radix Dialog (foco preso, Esc fecha, aria-modal). */

type DialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Largura do modal: "md" (padrão) ou "lg" para editores e conteúdo largo. */
  size?: "md" | "lg";
};

function Shell({ variant, open, onOpenChange, trigger, title, description, children, footer, size = "md" }: DialogProps & { variant: "modal" | "drawer" }) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/30 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-lg focus:outline-none",
            variant === "modal" && "left-1/2 top-1/2 max-h-[90dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl",
            variant === "modal" && (size === "lg" ? "max-w-2xl" : "max-w-lg"),
            variant === "drawer" && "inset-y-0 right-0 w-full max-w-md rounded-l-xl",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <RadixDialog.Title className="text-h3 font-bold text-neutral-900">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="mt-1 text-body-sm text-neutral-500">{description}</RadixDialog.Description> : null}
            </div>
            <RadixDialog.Close className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Fechar">
              <X className="size-5" />
            </RadixDialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</footer> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function Modal(props: DialogProps) {
  return <Shell variant="modal" {...props} />;
}

export function Drawer(props: DialogProps) {
  return <Shell variant="drawer" {...props} />;
}

export const DialogClose = RadixDialog.Close;
