import { createPool } from '@postlude/db/pool';

import { env } from '#/shared/env.ts';

/** One process, one pool: every consumer shares it, today better-auth's Drizzle adapter. */
export const pool = createPool(env.DATABASE_URL);
