import type { Metadata } from "next";
import { RequestResetForm } from "@/features/auth/recovery-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <div className="card p-8 sm:p-10">
      <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Esqueceu sua senha?</h1>
      <p className="mb-8 mt-2 text-body text-neutral-600">Acontece! Informe seu e-mail e enviaremos um link para criar uma nova.</p>
      <RequestResetForm />
    </div>
  );
}
