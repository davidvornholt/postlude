import { account, session, user, verification } from '@postlude/db/auth-schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { drizzle } from 'drizzle-orm/node-postgres';

import { pool } from '#/shared/db/pool.ts';
import { env } from '#/shared/env.ts';
import { createGitHubProfileMapper } from './authorization.ts';
import { oauthAccountOptions } from './oauth-options.ts';

const schema = { account, session, user, verification };
const db = drizzle(pool, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      mapProfileToUser: createGitHubProfileMapper(
        env.GITHUB_ALLOWED_ACCOUNT_ID,
      ),
    },
  },
  account: oauthAccountOptions,
  plugins: [tanstackStartCookies()],
});
