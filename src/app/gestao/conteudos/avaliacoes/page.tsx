import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Avaliações" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="learning"
        anyOf={["content.assessment.manage"]}
        title="Avaliações"
        description="Quizzes e avaliações de aprendizagem."
        soon={{ title: "Nenhuma avaliação criada", description: "Quizzes com questões, notas mínimas e tentativas.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
