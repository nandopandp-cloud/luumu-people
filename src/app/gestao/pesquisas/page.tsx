import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Pesquisas" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["survey.design", "survey.results.read_aggregate"]}
        title="Pesquisas"
        description="Clima, eNPS, satisfação e experiência — com anonimato garantido por arquitetura."
        soon={{ title: "O módulo de pesquisas está em construção", description: "Resultados sempre agregados e só exibidos com o número mínimo de respostas que preserva o anonimato.", phase: "Chega na Fase 4" }}
      />
    </Suspense>
  );
}
