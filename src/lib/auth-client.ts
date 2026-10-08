"use client";

import { createAuthClient } from "better-auth/react";

/** Cliente de autenticação (navegador). Fala apenas com /api/auth na mesma origem. */
export const authClient = createAuthClient({ basePath: "/api/auth" });
