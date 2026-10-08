import "server-only";
import pino from "pino";
import { env } from "@/server/env";

/**
 * Logger estruturado com redação de dados sensíveis.
 *
 * Regras (docs/security.md):
 *  - nunca logar senhas, tokens, cookies, cabeçalhos de autorização;
 *  - nunca logar payloads de respostas de pesquisa, nem identidade de quem respondeu;
 *  - preferir ids a dados pessoais (e-mail, nome) em mensagens de log.
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "newPassword",
  "*.newPassword",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "code",
  "*.code",
  "backupCodes",
  "*.backupCodes",
  "answers",
  "*.answers",
  "comment",
  "*.comment",
  "cookie",
  "*.cookie",
  "authorization",
  "*.authorization",
  "headers.cookie",
  "headers.authorization",
  "email",
  "*.email",
];

let instance: pino.Logger | undefined;

export function logger(): pino.Logger {
  instance ??= pino({
    level: env().LOG_LEVEL,
    base: { service: "luumu-people" },
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return instance;
}
