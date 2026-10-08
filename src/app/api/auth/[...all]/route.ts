import { getAuth } from "@/server/auth/auth";

/** Endpoints do Better Auth (login, logout, sessão, 2FA, redefinição de senha). */
export async function GET(request: Request) {
  return (await getAuth()).handler(request);
}

export async function POST(request: Request) {
  return (await getAuth()).handler(request);
}
