import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { SurveyBuilder } from "@/features/surveys/survey-builder";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { getOrganizationK } from "@/server/modules/surveys/service";

export const metadata: Metadata = { title: "Nova pesquisa" };

export default function NewSurveyPage() {
  return (
    <>
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Pesquisas", href: "/gestao/pesquisas" }, { label: "Nova pesquisa" }]} />
      </div>
      <h1 className="mb-6 text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Nova pesquisa</h1>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-xl" />}>
        <Builder />
      </Suspense>
    </>
  );
}

async function Builder() {
  const actor = await requirePermission("survey.design");
  return <SurveyBuilder organizationK={await getOrganizationK(actor)} canDesign={hasTenantWide(actor, "survey.design")} canLaunch={hasTenantWide(actor, "survey.launch")} />;
}
