import { Suspense, type ReactNode } from "react";
import { requireActor } from "@/server/dal";
import { requireModule, type ModuleKey } from "@/server/modules/flags/modules";

/** Renderiza o conteúdo somente se o módulo estiver ligado para a empresa; senão, 404. */
export function ModuleGate({ module, children, fallback = null }: { module: ModuleKey; children: ReactNode; fallback?: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <Gate module={module}>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ module, children }: { module: ModuleKey; children: ReactNode }) {
  await requireModule(await requireActor(), module);
  return <>{children}</>;
}
