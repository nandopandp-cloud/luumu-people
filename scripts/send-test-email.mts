/**
 * Disparo de TESTE do e-mail de convite pelo Resend, com diagnóstico.
 * Não cria usuário: o link do botão é fictício. Lê RESEND_API_KEY, EMAIL_FROM
 * e APP_URL de .env.local (ou do ambiente) e mostra a resposta do Resend.
 *
 *   pnpm tsx scripts/send-test-email.mts destinatario@exemplo.com
 */
import { config } from "dotenv";
import { inviteEmail } from "../src/server/email/templates/invite";

config({ path: [".env.local", ".env"], quiet: true });

const to = process.argv[2];
const key = process.env.RESEND_API_KEY?.trim();
const rawFrom = process.env.EMAIL_FROM ?? "";
const appUrl = (process.env.APP_URL ?? "").trim();

// Mesma regra do mailer (sem importar módulos server-only).
const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
function normalizeEmailFrom(raw: string): string | null {
  const value = raw.trim().replace(/^(["'])([^]*)\1$/, "$2").trim();
  const named = /^([^<>]+?)\s*<([^<>]+)>$/.exec(value);
  if (named) return ADDRESS.test(named[2]!.trim()) ? `${named[1]!.trim()} <${named[2]!.trim()}>` : null;
  return ADDRESS.test(value) ? value : null;
}

if (!to || !ADDRESS.test(to)) throw new Error("Informe o destinatário: pnpm tsx scripts/send-test-email.mts pessoa@exemplo.com");
if (!key) throw new Error("RESEND_API_KEY ausente em .env.local.");

const from = normalizeEmailFrom(rawFrom);
// Mostra o remetente com caracteres invisíveis à vista (sem nunca mostrar a chave).
console.info("EMAIL_FROM lido:", JSON.stringify(rawFrom));
console.info("EMAIL_FROM usado:", from ?? "(inválido)");
console.info("APP_URL:", appUrl || "(vazio)");
if (!from) throw new Error("EMAIL_FROM inválido. Use: Luumu People <nao-responda@seu-dominio-verificado>");

const message = inviteEmail({
  name: "Teste Luumu",
  inviterName: "Equipe Luumu People",
  organizationName: "Luumu",
  url: `${appUrl || "https://exemplo.invalid"}/convite?token=teste`,
  expiresAt: new Date(Date.now() + 7 * 86_400_000),
  assetBase: appUrl || "https://exemplo.invalid",
});

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from, to: [to], subject: `[TESTE] ${message.subject}`, text: message.text, html: message.html }),
});
console.info("Resend:", response.status, await response.text());
