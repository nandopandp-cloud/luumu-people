import type { Metadata } from "next";
import { ModuleGate } from "@/features/page/module-gate";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Biblioteca" };

export default function Page() {
  return (
    <ModuleGate module="library">
    <ModulePage
      title="Biblioteca"
      description="Conhecimento sempre ao seu alcance. Explore materiais, vídeos, podcasts, artigos e muito mais para aprender no seu tempo."
      bubble="Boas ideias constroem grandes pessoas!"
      soon={{
        title: "A biblioteca está sendo organizada",
        description: "Artigos, vídeos, podcasts, templates e playlists, com busca, categorias e favoritos.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
    </ModuleGate>
  );
}
