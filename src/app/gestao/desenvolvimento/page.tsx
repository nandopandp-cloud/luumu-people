import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Desenvolvimento" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["development.read"]}
        title="Desenvolvimento"
        description="Competências, PDIs e evolução das equipes."
        soon={{ title: "Desenvolvimento chega na próxima etapa", description: "Acompanhe PDIs, competências e necessidades de desenvolvimento.", phase: "Chega na Fase 3" }}
      />
    </Suspense>
  );
}
