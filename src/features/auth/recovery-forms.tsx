"use client";

import { CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { authClient } from "@/lib/auth-client";

export function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/redefinir-senha" });
      // Resposta igual exista ou não a conta (não revela e-mails cadastrados).
      if (err && err.status === 429) return setError("Muitas solicitações. Aguarde alguns minutos e tente novamente.");
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <CheckCircle2 aria-hidden className="mx-auto size-12 text-green-600" />
        <p className="text-body text-neutral-700" role="status">
          Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha. O link vale por 30 minutos.
        </p>
        <Link href="/entrar" className="inline-block text-body-sm font-medium text-purple-600 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label="E-mail corporativo">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} type="email" autoComplete="username" required autoFocus leading={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={pending} disabled={!email}>
        Enviar link
      </Button>
      <p className="text-center">
        <Link href="/entrar" className="text-body-sm font-medium text-purple-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const tokenError = params.get("error");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!token || tokenError) {
    return (
      <div className="space-y-5">
        <Alert tone="warning" title="Este link não é mais válido">
          Links de redefinição valem por 30 minutos e só podem ser usados uma vez.
        </Alert>
        <Button asChild block size="lg">
          <Link href="/recuperar-senha">Pedir um novo link</Link>
        </Button>
      </div>
    );
  }

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || mismatch) return;
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.resetPassword({ newPassword: password, token: token! });
      if (err) return setError(err.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Não foi possível redefinir a senha. Peça um novo link.");
      router.replace("/entrar?senha=redefinida");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label="Nova senha" hint="Use pelo menos 10 caracteres." error={tooShort ? "A senha precisa de pelo menos 10 caracteres." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      <Field label="Confirme a nova senha" error={mismatch ? "As senhas não são iguais." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={pending} disabled={!password || !confirm || tooShort || mismatch}>
        Salvar nova senha
      </Button>
    </form>
  );
}
