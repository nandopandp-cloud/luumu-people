import type { ReactNode } from "react";
import { ComingSoon } from "./coming-soon";
import { PageHero } from "./page-hero";

/** Página de módulo ainda não entregue: hero definitivo + aviso honesto da fase. */
export function ModulePage({
  title,
  description,
  bubble,
  soon,
}: {
  title: string;
  description: ReactNode;
  bubble?: ReactNode;
  soon: { title: ReactNode; description: ReactNode; phase: string };
}) {
  return (
    <>
      <PageHero title={title} description={description} bubble={bubble} />
      <ComingSoon {...soon} />
    </>
  );
}
