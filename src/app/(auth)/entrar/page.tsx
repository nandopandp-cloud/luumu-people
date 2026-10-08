import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <div className="card p-8 sm:p-10">
      <h1 className="text-h1 font-extrabold tracking-[-0.02em] text-neutral-900">Que bom ter você aqui!</h1>
      <p className="mb-8 mt-2 text-body text-neutral-600">Entre com sua conta da empresa para continuar.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
