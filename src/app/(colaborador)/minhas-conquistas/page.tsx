import type { Metadata } from "next";
import { ModulePage } from "@/features/page/module-page";

export const metadata: Metadata = { title: "Minhas conquistas" };

export default function Page() {
  return (
    <ModulePage
      title="Minhas conquistas"
      description="Cada aprendizado, cada ação e cada atitude te aproxima de uma versão ainda melhor. Continue assim!"
      soon={{
        title: "Suas conquistas vão brilhar aqui",
        description: "Nível, XP, selos, desafios e marcos da sua jornada de aprendizagem.",
        phase: "Chega na Fase 2 · Experiência do colaborador",
      }}
    />
  );
}
