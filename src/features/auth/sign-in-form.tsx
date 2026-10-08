"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/design-system/components/button";
import { Modal } from "@/design-system/components/dialog";
import { Alert } from "@/design-system/components/feedback";
import { Field, Input } from "@/design-system/components/field";
import { GoogleLogo, MicrosoftLogo } from "@/design-system/illustrations/provider-logos";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssoNotice, setSsoNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function done() {
    router.replace(next as never);
    router.refresh();
  }

  function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Informe seu e-mail e sua senha para entrar.");
      return;
    }
    startTransition(async () => {
      const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
      if (err) return setError(message(err.status, err.status === 429 ? err.message : undefined));
      done();
    });
  }

  const field = "h-[52px] rounded-md!";
  return (
    <>
      {/* method="post": sem JavaScript, as credenciais nunca vão para a URL. */}
      <form method="post" onSubmit={submitCredentials} className="space-y-5" noValidate>
        {error ? <Alert tone="error" title={error} /> : null}
        <Field label="E-mail">
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="email"
              autoComplete="username"
              required
              autoFocus
              leading={<Mail />}
              placeholder="seu@email.com"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <div>
          <Field label="Senha">
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                leading={<LockKeyhole />}
                placeholder="••••••••"
                className={field}
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
                    {showPassword ? <Eye className="size-[18px]" /> : <EyeOff className="size-[18px]" />}
                  </button>
                }
              />
            )}
          </Field>
          <div className="mt-2 flex justify-end">
            <Link href="/recuperar-senha" className="text-body-sm font-medium text-purple-600 hover:underline underline-offset-4">
              Esqueceu sua senha?
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" block loading={pending} className="h-[52px] rounded-md! text-body">
          Entrar <ArrowRight aria-hidden />
        </Button>
      </form>

      <div className="my-7 flex items-center gap-4 text-body-sm text-neutral-600">
        <span aria-hidden className="h-px flex-1 bg-line" />
        Ou continue com
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <div className="space-y-3">
        {[
          { name: "Microsoft", Logo: MicrosoftLogo },
          { name: "Google", Logo: GoogleLogo },
        ].map(({ name, Logo }) => (
          <Button
            key={name}
            type="button"
            variant="ghost"
            block
            className="h-[52px] rounded-md! text-body font-medium"
            aria-describedby={ssoNotice ? "sso-aviso" : undefined}
            onClick={() => setSsoNotice(`O acesso com ${name} fica disponível quando a sua empresa ativar o login corporativo (SSO). Por enquanto, entre com e-mail e senha.`)}
          >
            <Logo className="size-5" /> Entrar com {name}
          </Button>
        ))}
        {ssoNotice ? (
          <div id="sso-aviso">
            <Alert tone="info" title={ssoNotice} />
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Rodapé do login: contas são criadas pela empresa, não há cadastro público. */
export function NoAccountHelp() {
  const [open, setOpen] = useState(false);
  return (
    <p className="text-center text-body-sm text-neutral-600">
      Não tem uma conta?{" "}
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Seu acesso é criado pela empresa"
        description="A Luumu People não tem cadastro aberto."
        trigger={
          <button type="button" className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-700/80">
            Fale com o time da sua empresa.
          </button>
        }
        footer={<Button onClick={() => setOpen(false)}>Entendi</Button>}
      >
        <p className="text-body-sm text-neutral-600">
          Peça ao time de Gente &amp; Gestão (ou à pessoa administradora da plataforma) para criar o seu acesso. Você vai receber um e-mail com as instruções para definir a sua senha.
        </p>
      </Modal>
    </p>
  );
}
