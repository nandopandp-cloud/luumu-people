import type { Metadata } from "next";
import { Suspense } from "react";
import { NoAccountHelp, SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <>
      <h1 className="text-[2.1rem] font-extrabold leading-tight tracking-[-0.03em] text-neutral-900">Bem-vindo(a) de volta!</h1>
      <p className="mb-9 mt-3 text-[17px] leading-relaxed text-neutral-600">Acesse sua conta e continue evoluindo com o Luumu People.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
      <div className="mt-12 border-t border-line pt-8">
        <NoAccountHelp />
      </div>
    </>
  );
}
