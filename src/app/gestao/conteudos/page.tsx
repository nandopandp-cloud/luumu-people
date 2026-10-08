import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Conteúdos" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="learning"
        anyOf={["content.course.create", "content.path.manage", "content.library.manage", "content.assessment.manage"]}
        title="Conteúdos"
        description="Cursos, trilhas, biblioteca e avaliações em um só lugar."
        soon={{ title: "O estúdio de conteúdos está a caminho", description: "Crie, revise e publique conteúdos com o fluxo Rascunho → Em revisão → Aprovado → Publicado → Arquivado.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
