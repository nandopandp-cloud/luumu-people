import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Trilhas" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="learning"
        anyOf={["content.path.manage"]}
        title="Trilhas"
        description="Organize cursos em jornadas, com ordem, pré-requisitos e regras de conclusão."
        soon={{ title: "Nenhuma trilha por aqui ainda", description: "Trilhas por cargo, área, competência, onboarding e liderança.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
