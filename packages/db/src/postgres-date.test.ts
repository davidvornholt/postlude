import { expect, it } from 'bun:test';
import pg from 'pg';

import { preservePostgresDates } from './postgres-date.ts';

const postgresDateOid = 1082;
const postgresTimestamptzOid = 1184;

it('hands a raw DATE read back as the calendar date Postgres sent', () => {
  preservePostgresDates();
  expect(pg.types.getTypeParser(postgresDateOid)('2026-08-23')).toBe(
    '2026-08-23',
  );
});

it('leaves timestamptz parsing alone, since only DATE loses meaning as a Date', () => {
  preservePostgresDates();
  expect(
    pg.types.getTypeParser(postgresTimestamptzOid)('2026-08-23 04:00:00+00'),
  ).toBeInstanceOf(Date);
});
