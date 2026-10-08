import { getAuth } from "@/server/auth/auth";
import { TEST_PASSWORD, userOf } from "./db";

/** Faz login real pelo Better Auth e devolve o cabeçalho Cookie da sessão. */
export async function signIn(slug: string, key: string, password = TEST_PASSWORD): Promise<{ cookie: string; userId: string; tenantId: string }> {
  const user = await userOf(slug, key);
  const auth = await getAuth();
  const response = await auth.api.signInEmail({
    body: { email: user.email, password },
    headers: new Headers({ "x-forwarded-for": "203.0.113.10", "user-agent": "vitest" }),
    asResponse: true,
  });
  if (response.status !== 200) throw new Error(`login falhou para ${key}: ${response.status}`);
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { cookie, userId: user.id, tenantId: user.tenantId };
}

export function headersWith(cookie: string, extra: Record<string, string> = {}): Headers {
  return new Headers({ cookie, ...extra });
}
