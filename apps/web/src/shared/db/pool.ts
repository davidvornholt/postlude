import { createPool } from '@postlude/db/pool';

import { env } from '#/shared/env.ts';

/** One process, one pool: better-auth and the Effect layer share it. */
export const pool = createPool(env.DATABASE_URL);
