import pg from 'pg';

const postgresDateOid = 1082;

/** DATE values are calendar dates and must never pass through a timezone. */
export const preservePostgresDates = (): void => {
  pg.types.setTypeParser(postgresDateOid, (value) => value);
};
