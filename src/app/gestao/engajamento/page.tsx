import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Engajamento" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        module="learning"
        anyOf={["learning.progress.read", "content.analytics.read"]}
        title="Engajamento"
        description="Participação em cursos, trilhas e conteúdos."
        soon={{ title: "Os dados de engajamento chegam com os cursos", description: "Acessos, conclusões e tempo de uso, sempre dentro do seu escopo.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
