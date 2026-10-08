import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Biblioteca" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="library"
        anyOf={["content.library.manage"]}
        title="Biblioteca"
        description="Gerencie artigos, vídeos, podcasts, templates e playlists."
        soon={{ title: "A biblioteca está vazia", description: "Em breve você poderá publicar materiais com categorias e destaques.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
