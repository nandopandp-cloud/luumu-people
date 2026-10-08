import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Desenvolvimento" };

export default function Page() {
  return (
    <ModulePage
      title="Desenvolvimento"
      description="Seu crescimento é único. Aqui você encontra trilhas, competências e planos para evoluir na sua carreira."
      bubble="Grandes pessoas estão sempre em desenvolvimento!"
      soon={{
        title: "Seu plano de desenvolvimento vem aí",
        description: "Competências, PDI, metas e recomendações personalizadas para a sua carreira.",
        phase: "Chega na Fase 3 · Desenvolvimento de pessoas",
      }}
    />
  );
}
