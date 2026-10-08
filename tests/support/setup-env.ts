// Ambiente determinístico para testes: banco PGlite em memória por processo.
process.env.DATABASE_URL = "pglite://memory";
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-0000";
process.env.APP_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "silent";
