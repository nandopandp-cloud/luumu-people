"use client";

import { LockKeyhole } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { authClient } from "@/lib/auth-client";

/** Troca de senha pelo próprio usuário. Encerra as outras sessões abertas. */
export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const tooShort = next.length > 0 && next.length < 10;
  const mismatch = confirm.length > 0 && confirm !== next;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || mismatch) return;
    setResult(null);
    startTransition(async () => {
      const { error } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
      if (error) {
        setResult({ tone: "error", text: error.status === 400 || error.status === 401 ? "A senha atual não confere." : "Não foi possível alterar a senha agora. Tente novamente." });
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setResult({ tone: "success", text: "Senha alterada. As outras sessões abertas foram encerradas." });
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {result ? <Alert tone={result.tone} title={result.text} /> : null}
      <Field label="Senha atual">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} type="password" autoComplete="current-password" leading={<LockKeyhole />} value={current} onChange={(e) => setCurrent(e.target.value)} />
        )}
      </Field>
      <Field label="Nova senha" hint="Use pelo menos 10 caracteres." error={tooShort ? "A senha precisa de pelo menos 10 caracteres." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" leading={<LockKeyhole />} value={next} onChange={(e) => setNext(e.target.value)} />
        )}
      </Field>
      <Field label="Confirme a nova senha" error={mismatch ? "As senhas não são iguais." : null}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="password" autoComplete="new-password" leading={<LockKeyhole />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!current || !next || !confirm || tooShort || mismatch}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
