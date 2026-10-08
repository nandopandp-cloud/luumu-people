import { forbidden } from "next/navigation";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere } from "@/server/authz/policy";
import { requireActor } from "@/server/dal";
import { ComingSoon } from "./coming-soon";

/** Módulo de gestão de uma fase futura — ainda assim protegido por permissão. */
export async function ManagementModulePage({ anyOf, title, description, soon }: { anyOf: Permission[]; title: string; description: string; soon: { title: string; description: string; phase: string } }) {
  const actor = await requireActor();
  if (!anyOf.some((p) => hasPermissionAnywhere(actor, p))) forbidden();
  return (
    <>
      <header className="mb-6">
        <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">{title}</h1>
        <p className="mt-1 text-body text-neutral-600">{description}</p>
      </header>
      <ComingSoon {...soon} />
    </>
  );
}
