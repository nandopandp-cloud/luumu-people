"use client";

import { Menu as MenuIcon, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState, type ReactNode } from "react";

/**
 * Gaveta de navegação no mobile/tablet. Recebe a navegação já renderizada no
 * servidor (filtrada por permissão) como children.
 */
export function MobileMenuButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-white text-neutral-700 lg:hidden" aria-label="Abrir menu">
        <MenuIcon className="size-5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-neutral-900/30 lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white p-4 shadow-lg focus:outline-none lg:hidden" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <Dialog.Close className="self-end rounded-full p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Fechar menu">
            <X className="size-5" />
          </Dialog.Close>
          {/* Fecha a gaveta ao seguir um link de navegação. */}
          <div className="flex-1 overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
