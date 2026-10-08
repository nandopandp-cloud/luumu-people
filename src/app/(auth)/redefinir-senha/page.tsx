import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/recovery-forms";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <div>
      <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Crie uma nova senha</h1>
      <p className="mb-8 mt-2 text-body text-neutral-600">Depois de salvar, todas as suas sessões abertas serão encerradas por segurança.</p>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
