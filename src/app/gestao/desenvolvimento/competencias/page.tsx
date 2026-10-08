import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/feedback";
import { Breadcrumb } from "@/design-system/components/navigation";
import { NewCompetencyButton } from "@/features/development/competency-form";
import { CATEGORY_LABEL, COMPETENCY_ICONS } from "@/features/development/labels";
import { hasTenantWide } from "@/server/authz/policy";
import { requirePermission } from "@/server/dal";
import { listCompetencyCatalog } from "@/server/modules/development/service";

export const metadata: Metadata = { title: "Competências" };

export default function CompetencyCatalogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[420px] rounded-xl" />}>
      <Catalog />
    </Suspense>
  );
}

async function Catalog() {
  const actor = await requirePermission("development.pdi.manage");
  if (!hasTenantWide(actor, "development.pdi.manage")) forbidden();
  const items = await listCompetencyCatalog(actor);
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Desenvolvimento", href: "/gestao/desenvolvimento" }, { label: "Competências" }]} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Catálogo de competências</h1>
          <p className="mt-1 text-body text-neutral-600">As competências que a empresa desenvolve e avalia.</p>
        </div>
        <NewCompetencyButton />
      </header>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => {
          const Icon = COMPETENCY_ICONS[c.icon] ?? COMPETENCY_ICONS.target!;
          return (
            <li key={c.id}>
              <Card className="flex h-full gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-500">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-h4 font-semibold text-neutral-900">{c.name}</h2>
                  <Badge tone="neutral" className="mt-1">
                    {CATEGORY_LABEL[c.category] ?? c.category}
                  </Badge>
                  {c.description ? <p className="mt-2 text-body-sm text-neutral-600">{c.description}</p> : null}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
