// Ambiente determinístico para testes: banco PGlite em memória por processo.
process.env.DATABASE_URL = "pglite://memory";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-0000";
process.env.APP_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "silent";
// Login com Google ligado com credenciais fictícias: o endpoint de token é simulado nos testes.
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
