import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { Breadcrumb } from "@/design-system/components/navigation";

/** Cabeçalho das telas de criar/editar comunicado. */
export function EditorHeader({ title, description, current }: { title: string; description: string; current: string }) {
  return (
    <header className="mb-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/gestao/comunicacao" aria-label="Voltar para os comunicados" className="flex size-7 items-center justify-center rounded-full text-neutral-600 hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-purple-500">
          <ArrowLeft aria-hidden className="size-4" />
        </Link>
        <Breadcrumb items={[{ label: "Comunicação", href: "/gestao/comunicacao" }, { label: "Comunicados", href: "/gestao/comunicacao" }, { label: current }]} />
      </div>
      <div className="flex items-start gap-4">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
          <FileText className="size-6" />
        </span>
        <div>
          <h1 className="text-h1 font-extrabold leading-tight tracking-[-0.02em] text-neutral-900">{title}</h1>
          <p className="mt-1 text-body-sm text-neutral-600">{description}</p>
        </div>
      </div>
    </header>
  );
}
