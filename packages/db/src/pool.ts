import pg from 'pg';

import { preservePostgresDates } from './postgres-date.ts';

/**
 * One process, one pool: better-auth and the Effect layer share the pool the
 * app creates from this factory.
 */
export const createPool = (connectionString: string): pg.Pool => {
  preservePostgresDates();
  return new pg.Pool({ connectionString });
};
