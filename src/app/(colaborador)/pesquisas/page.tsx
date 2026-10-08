import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Pesquisas" };

export default function Page() {
  return (
    <ModulePage
      title="Pesquisas"
      description="Sua opinião importa! Ajude a construir um ambiente cada vez melhor para todos."
      bubble="Sua voz faz a diferença!"
      soon={{
        title: "Nenhuma pesquisa por aqui ainda",
        description:
          "Quando houver uma pesquisa para você, ela aparece aqui. Pesquisas anônimas são anônimas de verdade: suas respostas nunca ficam ligadas ao seu nome.",
        phase: "Chega na Fase 4 · Pesquisas",
      }}
    />
  );
}
