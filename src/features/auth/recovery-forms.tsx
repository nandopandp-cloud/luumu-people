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
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
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

/** `invite`: primeiro acesso pelo convite (textos próprios; o link vale 7 dias). */
export function ResetPasswordForm({ variant = "reset" }: { variant?: "reset" | "invite" } = {}) {
  const invite = variant === "invite";
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
        <Alert tone="warning" title={invite ? "Este convite não é mais válido" : "Este link não é mais válido"}>
          {invite
            ? "Convites valem por 7 dias e só podem ser usados uma vez. Peça um novo convite à equipe de Gente & Gestão, ou crie a senha por “Esqueci minha senha”."
            : "Links de redefinição valem por 30 minutos e só podem ser usados uma vez."}
        </Alert>
        <Button asChild block size="lg">
          <Link href="/recuperar-senha">{invite ? "Criar senha pelo e-mail" : "Pedir um novo link"}</Link>
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
      if (err) return setError(err.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : invite ? "Não foi possível ativar seu acesso. O convite pode ter expirado." : "Não foi possível redefinir a senha. Peça um novo link.");
      router.replace(invite ? "/entrar?acesso=ativado" : "/entrar?senha=redefinida");
    });
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label={invite ? "Crie sua senha" : "Nova senha"} hint="Use pelo menos 10 caracteres." error={tooShort ? "A senha precisa de pelo menos 10 caracteres." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      <Field label={invite ? "Confirme a senha" : "Confirme a nova senha"} error={mismatch ? "As senhas não são iguais." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={pending} disabled={!password || !confirm || tooShort || mismatch}>
        {invite ? "Ativar meu acesso" : "Salvar nova senha"}
      </Button>
    </form>
  );
}

/** Troca obrigatória no primeiro acesso (senha provisória da importação). */
export function ChangeProvisionalPasswordForm({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tooShort = password.length > 0 && password.length < 10;
  const same = password.length > 0 && password === current;
  const mismatch = confirm.length > 0 && confirm !== password;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || same || mismatch) return;
    setError(null);
    startTransition(async () => {
      const { error: err } = await authClient.changePassword({ currentPassword: current, newPassword: password, revokeOtherSessions: true });
      if (err) {
        if (err.status === 429) return setError("Muitas tentativas. Aguarde alguns minutos.");
        return setError(err.code === "INVALID_PASSWORD" ? "A senha provisória não confere." : (err.message ?? "Não foi possível salvar a senha. Tente novamente."));
      }
      router.replace("/inicio");
      router.refresh();
    });
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-5" noValidate>
      {firstName ? <p className="text-body text-neutral-700">Olá, {firstName}! 👋</p> : null}
      {error ? <Alert tone="error" title={error} /> : null}
      <Field label="Senha provisória" hint="A que você recebeu para o primeiro acesso.">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} type="password" autoComplete="current-password" required leading={<LockKeyhole />} value={current} onChange={(e) => setCurrent(e.target.value)} />
        )}
      </Field>
      <Field label="Nova senha" hint="Use pelo menos 10 caracteres." error={tooShort ? "A senha precisa de pelo menos 10 caracteres." : same ? "A nova senha precisa ser diferente da provisória." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={password} onChange={(e) => setPassword(e.target.value)} />
        )}
      </Field>
      <Field label="Confirme a nova senha" error={mismatch ? "As senhas não são iguais." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" required leading={<LockKeyhole />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <Button type="submit" size="lg" block loading={pending} disabled={!current || !password || !confirm || tooShort || same || mismatch}>
        Salvar e continuar
      </Button>
    </form>
  );
}
