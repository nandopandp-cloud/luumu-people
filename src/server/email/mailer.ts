import "server-only";
import { env } from "@/server/env";
import { logger } from "@/server/observability/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Envio de e-mail transacional.
 *  - produção: Resend (RESEND_API_KEY obrigatória — sem ela o envio falha alto);
 *  - desenvolvimento: o conteúdo é impresso no terminal para permitir testar
 *    fluxos como "esqueci minha senha" sem provedor;
 *  - teste: descartado.
 */
const ADDRESS = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/**
 * Remetente no formato aceito pelo Resend: `Nome <email@dominio>` ou `email@dominio`.
 * Tolera aspas e espaços colados junto no painel da Vercel; null se inválido.
 */
export function normalizeEmailFrom(raw: string): string | null {
  const value = raw.trim().replace(/^(["'])([^]*)\1$/, "$2").trim();
  const named = /^([^<>]+?)\s*<([^<>]+)>$/.exec(value);
  if (named) return ADDRESS.test(named[2]!.trim()) ? `${named[1]!.trim()} <${named[2]!.trim()}>` : null;
  return ADDRESS.test(value) ? value : null;
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const { NODE_ENV, RESEND_API_KEY, EMAIL_FROM } = env();

  if (NODE_ENV === "test") return;

  if (!RESEND_API_KEY) {
    if (NODE_ENV === "production") throw new Error("RESEND_API_KEY não configurada: e-mails não podem ser enviados.");
    // Somente em desenvolvimento local.
    console.info(`\n[e-mail de desenvolvimento] Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`);
    return;
  }

  const from = normalizeEmailFrom(EMAIL_FROM);
  if (!from) {
    logger().error({ event: "email.invalid_from" }, "EMAIL_FROM inválido: use o formato Nome <email@dominio-verificado>, sem aspas");
    throw new Error("EMAIL_FROM inválido.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) {
    // Motivo devolvido pelo Resend (ex.: domínio não verificado, remetente inválido). Não contém a chave.
    const detail = await response.json().catch(() => null) as { name?: string; message?: string } | null;
    logger().error({ status: response.status, reason: detail?.name, detail: detail?.message }, "falha no envio de e-mail transacional");
    throw new Error("Não foi possível enviar o e-mail.");
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
