import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

import { isTimeZone } from './time-zone.ts';

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
    /**
     * The zone whose clock decides which journal day an entry belongs to. It is
     * configured rather than read from the device so that the same evening is
     * one journal day from every device, and a trip abroad neither splits a
     * night in two nor hides the day just written.
     *
     * Checked against the platform's own zone database at boot: a zone the
     * platform cannot resolve would otherwise be discovered as a wrong date on
     * a page, which is the kind of wrong nobody notices until a streak breaks.
     */
    JOURNAL_TIME_ZONE: z
      .string()
      .refine(isTimeZone, 'must be an IANA time zone, such as Europe/Berlin'),
  },
  clientPrefix: 'VITE_',
  client: {},
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
