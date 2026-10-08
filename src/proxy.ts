import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem OTIMISTA: sem cookie de sessão, manda para o login. Não é
 * autorização — a sessão é validada no servidor em cada página e rota da API.
 */
const SESSION_COOKIES = ["luumu.session_token", "__Secure-luumu.session_token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  const target = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/entrar";
  url.search = target && target !== "/" ? `?next=${encodeURIComponent(target)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo, exceto: login e recuperação de senha, vitrine do design system (404 em
  // produção), API (protege a si mesma), assets e tudo de /_next — inclusive o
  // canal de HMR do dev, que redirecionado para o login recarregava /entrar em loop.
  // Arquivos estáticos de /public (qualquer caminho com extensão, ex.: /sidebar-init.js) também ficam fora.
  matcher: ["/((?!entrar|recuperar-senha|redefinir-senha|design-system|api|_next|brand|.*\\..*).*)"],
};
