import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Busca" };

export default function Page() {
  return (
    <ModulePage
      title="Busca"
      description="Encontre cursos, trilhas, conteúdos e pessoas em um só lugar."
      soon={{
        title: "A busca unificada chega com os conteúdos",
        description: "Assim que cursos, trilhas e a biblioteca estiverem disponíveis, você poderá buscar tudo por aqui.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}
