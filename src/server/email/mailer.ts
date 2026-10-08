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
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { NODE_ENV, RESEND_API_KEY, EMAIL_FROM } = env();

  if (NODE_ENV === "test") return;

  if (!RESEND_API_KEY) {
    if (NODE_ENV === "production") throw new Error("RESEND_API_KEY não configurada: e-mails não podem ser enviados.");
    // Somente em desenvolvimento local.
    console.info(`\n[e-mail de desenvolvimento] Para: ${message.to}\nAssunto: ${message.subject}\n\n${message.text}\n`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
  });
  if (!response.ok) {
    logger().error({ status: response.status }, "falha no envio de e-mail transacional");
    throw new Error("Não foi possível enviar o e-mail.");
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
