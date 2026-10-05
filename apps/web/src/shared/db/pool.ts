import { createPool } from '@postlude/db/pool';

import { env } from '#/shared/env.ts';

/** Every `pg` consumer shares it, today better-auth's Drizzle adapter; the Effect SQL client opens its own. */
export const pool = createPool(env.DATABASE_URL);
