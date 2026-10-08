import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Cursos" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="learning"
        anyOf={["content.course.create", "content.course.edit"]}
        title="Cursos"
        description="Monte cursos com aulas, materiais, avaliações e certificados."
        soon={{ title: "Nenhum curso por aqui ainda", description: "Em breve você poderá criar cursos com vídeos, PDFs, quizzes e certificados.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
