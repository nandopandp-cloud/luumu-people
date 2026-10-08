import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Comunicação" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["comms.announcement.create"]}
        title="Comunicação"
        description="Mural corporativo: publique, agende e segmente comunicados."
        soon={{ title: "Nenhum comunicado criado", description: "Comunicados com imagem, vídeo, anexos, CTA e segmentação por área, unidade ou cargo.", phase: "Chega na Fase 2" }}
      />
    </Suspense>
  );
}
