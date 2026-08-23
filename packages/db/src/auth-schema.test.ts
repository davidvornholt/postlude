import { expect, it } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { account } from './auth-schema.ts';

it('account carries exactly one unique key, over (issuer, account_id)', () => {
  const config = getTableConfig(account);
  const uniqueKeys = [
    ...config.uniqueConstraints.map((constraint) =>
      constraint.columns.map((column) => column.name),
    ),
    ...config.indexes
      .filter((index) => index.config.unique)
      .map((index) =>
        index.config.columns.map((column) =>
          'name' in column ? column.name : null,
        ),
      ),
  ];
  expect(uniqueKeys).toEqual([['issuer', 'account_id']]);
});
