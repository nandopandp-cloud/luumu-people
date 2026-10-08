import type { Metadata } from "next";
import { Suspense } from "react";
import { ManagementModulePage } from "@/features/page/management-module-page";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <Suspense>
      <ManagementModulePage
        anyOf={["tenant.settings.manage", "access.roles.manage", "tenant.feature_flags.manage"]}
        title="Configurações"
        description="Papéis, segurança, SSO, campos editáveis e recursos da plataforma."
        soon={{ title: "Configurações em breve", description: "SSO (Google Workspace e Microsoft Entra ID), MFA obrigatório, papéis personalizados e feature flags.", phase: "Chega na Fase 5" }}
      />
    </Suspense>
  );
}
