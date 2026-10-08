import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Trilhas" };

export default function Page() {
  return (
    <ModulePage
      title="Trilhas de Aprendizagem"
      description="Desenvolva suas habilidades com jornadas personalizadas e conteúdos práticos para o seu crescimento."
      bubble="Pequenos aprendizados constroem grandes futuros!"
      soon={{
        title: "As trilhas estão a caminho",
        description: "Trilhas por área, cargo e competência, obrigatórias e recomendadas para você.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}
