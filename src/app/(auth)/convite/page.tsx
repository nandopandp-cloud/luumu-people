import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/recovery-forms";

export const metadata: Metadata = { title: "Ative seu acesso" };

/** Convite de acesso: a pessoa cria a senha (o mesmo token de uso único da redefinição, válido por 7 dias). */
export default function Page() {
  return (
    <div>
      <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Boas-vindas! Crie sua senha</h1>
      <p className="mb-8 mt-2 text-body text-neutral-600">Você foi convidado(a) para o Luumu People. Depois de criar a senha, é só entrar com o seu e-mail corporativo.</p>
      <Suspense>
        <ResetPasswordForm variant="invite" />
      </Suspense>
    </div>
  );
}
