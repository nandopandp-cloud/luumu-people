"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/design-system/components/button";
import { Mascot } from "@/design-system/components/brand";
import { Modal } from "@/design-system/components/dialog";

/** "Precisa de ajuda? Pergunte para o Luumu" — o assistente chega com a flag ai_assistant. */
export function HelpCard() {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Oi! Eu sou o Luumu"
      description="Em breve vou poder tirar suas dúvidas sobre seu desenvolvimento e a plataforma."
      trigger={
        <button
          type="button"
          className="group flex w-full items-center gap-2.5 rounded-lg border border-line bg-white p-3 text-left shadow-sm transition-colors hover:border-purple-200 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-500 sidebar-collapsed:justify-center sidebar-collapsed:p-2"
        >
          <Mascot className="h-10 shrink-0" />
          <span className="min-w-0 flex-1 sidebar-collapsed:sr-only">
            <span className="block whitespace-nowrap text-[13px] font-semibold text-neutral-900">Precisa de ajuda?</span>
            <span className="block whitespace-nowrap text-caption text-neutral-500">Pergunte para o Luumu</span>
          </span>
          <ChevronRight aria-hidden className="size-4 text-neutral-500 transition-transform group-hover:translate-x-0.5 sidebar-collapsed:hidden" />
        </button>
      }
      footer={<Button onClick={() => setOpen(false)}>Combinado</Button>}
    >
      <p className="text-body-sm text-neutral-600">
        Enquanto isso, se você tiver qualquer dúvida sobre seus treinamentos ou sobre a plataforma, fale com o time de Gente &amp; Gestão da sua empresa.
      </p>
    </Modal>
  );
}
