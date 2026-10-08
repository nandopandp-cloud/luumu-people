import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["reports.read"]}
        title="Relatórios"
        description="Indicadores executivos e exportações."
        soon={{ title: "Relatórios a caminho", description: "Exportações em CSV, Excel e PDF sempre respeitando permissões e anonimato.", phase: "Chega na Fase 6" }}
      />
    </Suspense>
  );
}
