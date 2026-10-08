import { hash, verify } from "@node-rs/argon2";

/**
 * Hash de senha com Argon2id (padrão da biblioteca), parâmetros OWASP 2024:
 * m=19 MiB, t=2, p=1. Nunca armazenamos senha em texto puro.
 */
const options = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, options);
}

export async function verifyPassword({ hash: digest, password }: { hash: string; password: string }): Promise<boolean> {
  try {
    return await verify(digest, password);
  } catch {
    return false;
  }
}
