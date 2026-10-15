import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChangeProvisionalPasswordForm } from "@/features/auth/recovery-forms";
import { getSessionActor } from "@/server/dal";

export const metadata: Metadata = { title: "Crie sua senha" };

/** Primeiro acesso com senha provisória: só sai daqui com a própria senha. */
export default function Page() {
  return (
    <div>
      <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Crie sua senha</h1>
      <p className="mb-8 mt-2 text-body text-neutral-600">Você entrou com a senha provisória. Para proteger sua conta, crie uma senha só sua antes de continuar.</p>
      <Suspense>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const actor = await getSessionActor();
  if (!actor) redirect("/entrar");
  if (!actor.mustChangePassword) redirect("/inicio");
  return <ChangeProvisionalPasswordForm firstName={actor.user.name.split(" ")[0] ?? ""} />;
}
