import { expect, it } from 'bun:test';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';

import { account } from './auth-schema.ts';

const dialect = new PgDialect();

/**
 * A unique key only guarantees uniqueness where it covers every row. A partial
 * unique index carries a `where` predicate, and rows outside that predicate may
 * repeat the pair freely, so the pin records the predicate alongside the columns
 * rather than only the columns: a narrowed index then fails here instead of
 * letting two accounts share (issuer, account_id) until an OAuth callback finds
 * both.
 */
it('account carries exactly one unique key, over (issuer, account_id), covering every row', () => {
  const config = getTableConfig(account);
  const uniqueKeys = [
    ...config.uniqueConstraints.map((constraint) => ({
      columns: constraint.columns.map((column) => column.name),
      partialWhere: null,
    })),
    ...config.indexes
      .filter((index) => index.config.unique)
      .map((index) => ({
        columns: index.config.columns.map((column) =>
          'name' in column ? column.name : null,
        ),
        partialWhere:
          index.config.where === undefined
            ? null
            : dialect.sqlToQuery(index.config.where).sql,
      })),
  ];
  expect(uniqueKeys).toEqual([
    { columns: ['issuer', 'account_id'], partialWhere: null },
  ]);
});
