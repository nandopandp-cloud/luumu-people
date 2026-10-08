import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Fronteiras de arquitetura (docs/architecture.md).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/db/**", "src/server/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/db/client",
              message: "Acesse o banco somente via withTenant() (src/server/db/tenant.ts): é ele que aplica a RLS por tenant.",
            },
          ],
        },
      ],
    },
  },
  {
    // Componentes de cliente nunca importam código de servidor.
    files: ["src/design-system/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/server/*"], message: "Código de servidor não pode ir para o design system/cliente." }] }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
