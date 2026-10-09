import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-[-0.025em] text-neutral-900">Bem-vindo(a)!</h1>
      <p className="mb-6 mt-1.5 text-body-sm leading-relaxed text-neutral-600">Acesse sua conta e continue evoluindo com o Luumu People.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}
