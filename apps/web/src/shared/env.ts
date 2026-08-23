import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

/**
 * Server-side configuration. Public development values live in config/dev.yaml,
 * secrets come from secrets/dev.yaml — `just dev-env-generate` composes both
 * into .env.local (see apps/web/README.md).
 */
const minSecretLength = 32;

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(minSecretLength),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    /** Positive decimal GitHub account ID of the only allowed account. */
    GITHUB_ALLOWED_ACCOUNT_ID: z.string().regex(/^[1-9]\d*$/u),
  },
  clientPrefix: 'VITE_',
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
