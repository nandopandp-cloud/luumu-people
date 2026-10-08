import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Design system" };

/** Vitrine dos componentes — somente fora de produção (revisão visual e testes de acessibilidade). */
export default function DesignSystemPage() {
  return (
    <Suspense>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  await connection();
  if (process.env.NODE_ENV === "production") notFound();
  return <Showcase />;
}
