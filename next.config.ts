import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * CSP estática (sem nonce): nonces exigem renderização dinâmica em todas as
 * páginas e são incompatíveis com o static shell do Cache Components.
 * Nenhuma origem de terceiros é permitida — em especial, nenhum script de
 * analytics (requisito das páginas de pesquisa). Ver docs/security.md.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  // Somente players de vídeo permitidos nas aulas (YouTube sem cookies e Vimeo).
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  typedRoutes: true,
  serverExternalPackages: ["@electric-sql/pglite", "@node-rs/argon2", "pino"],
  experimental: {
    authInterrupts: true,
    // Validação de "instant navigation" só em segmentos que exportam `instant`.
    // A validação automática de todas as rotas dispara um erro interno do
    // bundler no Next 16.4 (módulo ausente do client manifest) em dev.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Respostas autenticadas nunca devem ser cacheadas por CDNs/proxies.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
