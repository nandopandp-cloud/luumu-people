"use client";

import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "./safe-redirect";

const MESSAGES: Record<number, string> = {
  401: "E-mail ou senha incorretos. Confira e tente de novo.",
  403: "Não foi possível entrar com esta conta. Fale com o time de Gente & Gestão.",
  429: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
};

function message(status: number | undefined, fallback?: string) {
  return (status && MESSAGES[status]) || fallback || "Não foi possível entrar agora. Tente novamente em instantes.";
}

export function SignInForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [step, setStep] = useState<"credentials" | "totp">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function done() {
    router.replace(next as never);
    router.refresh();
  }

  function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const { data, error: err } = await authClient.signIn.email({ email: email.trim(), password });
      if (err) return setError(message(err.status, err.status === 429 ? err.message : undefined));
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return setStep("totp");
      done();
    });
  }

  function submitTotp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (err) return setError(err.status === 429 ? message(429) : "Código inválido ou expirado. Confira o app autenticador.");
      done();
    });
  }

  if (step === "totp") {
    return (
      <form onSubmit={submitTotp} className="space-y-5" noValidate>
        <div className="flex items-center gap-3 rounded-lg bg-purple-50 p-4 text-body-sm text-purple-700">
          <ShieldCheck aria-hidden className="size-5 shrink-0" />
          Sua conta tem verificação em duas etapas. Digite o código de 6 dígitos do seu app autenticador.
        </div>
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="Código de verificação">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-h3 tracking-[0.5em]"
            />
          )}
        </Field>
        <Button type="submit" size="lg" block loading={pending} disabled={code.length !== 6}>
          Verificar e entrar
        </Button>
        <button type="button" onClick={() => setStep("credentials")} className="w-full text-center text-body-sm font-medium text-purple-600 hover:underline">
          Voltar
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCredentials} className="space-y-5" noValidate>
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label="E-mail corporativo">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="email"
            autoComplete="username"
            required
            autoFocus
            leading={<Mail />}
            placeholder="voce@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Senha">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            leading={<LockKeyhole />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        )}
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
          Esqueci minha senha
        </Link>
      </div>
      <Button type="submit" size="lg" block loading={pending} disabled={!email || !password}>
        Entrar
      </Button>
    </form>
  );
}
