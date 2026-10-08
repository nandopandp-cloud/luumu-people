import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Personalização" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["tenant.settings.manage"]}
        title="Personalização"
        description="Identidade visual e textos da plataforma para a sua empresa."
        soon={{ title: "Personalização em breve", description: "Ajuste cores de destaque, textos de boas-vindas e links rápidos.", phase: "Chega na Fase 5" }}
      />
    </Suspense>
  );
}
