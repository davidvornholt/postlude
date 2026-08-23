import { describe, expect, it } from 'bun:test';
import { account, session, user, verification } from '@postlude/db/auth-schema';
import type { DBFieldAttribute } from 'better-auth/db';
import { getAuthTables } from 'better-auth/db';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

import { createAuthOptions } from './auth-options.ts';

/**
 * The schema object `auth.ts` hands to better-auth's Drizzle adapter. The
 * adapter looks a table up by the better-auth model name — `schema[model]` —
 * and then a column by the field name, so both keys are part of the contract.
 */
const drizzleSchema: Record<string, PgTable> = {
  account,
  session,
  user,
  verification,
};

/**
 * better-auth derives its required tables from the options object, so the
 * contract is read from the app's real option shape instead of being restated
 * here: a field better-auth adds in a future release shows up on its own. Only
 * plugins, social providers and the account options shape the tables, so this
 * needs neither a database nor real configuration values.
 */
const requiredTables = getAuthTables(
  createAuthOptions({
    allowedGitHubAccountId: '1',
    baseURL: 'http://localhost:3000',
    githubClientId: 'contract-test-client-id',
    githubClientSecret: 'contract-test-client-secret',
    secret: 'contract-test-secret-with-at-least-32-chars',
  }),
);

/** better-auth owns `id` on every model and never lists it among the fields. */
const primaryKeyColumn = 'id';

/** A field's column name defaults to the field key unless the options rename it. */
const columnNameOf = (fieldKey: string, field: DBFieldAttribute) =>
  field.fieldName ?? fieldKey;

/** Fields are required unless better-auth explicitly marks them optional. */
const isRequired = (field: DBFieldAttribute) => field.required !== false;

/**
 * better-auth names a field's type in its own vocabulary; Drizzle reports the
 * column's `dataType` in Drizzle's. The two line up for the primitives the
 * adapter reads and writes. A type that is not mapped here is reported as a
 * mismatch rather than skipped, so a field type a future better-auth release
 * introduces has to be decided on instead of passing unnoticed.
 */
const drizzleDataTypes: Record<string, string | undefined> = {
  boolean: 'boolean',
  date: 'date',
  json: 'json',
  number: 'number',
  string: 'string',
};

const expectedDataType = (field: DBFieldAttribute) => {
  const declared = String(field.type);
  return drizzleDataTypes[declared] ?? `unmapped better-auth type ${declared}`;
};

const modelsUnderContract = Object.entries(requiredTables).flatMap(
  ([model, definition]) => {
    const table = drizzleSchema[model];
    return table === undefined ? [] : [{ definition, model, table }];
  },
);

describe('better-auth table contract', () => {
  it('exports a Drizzle table for exactly the models better-auth requires', () => {
    expect(Object.keys(drizzleSchema).sort()).toEqual(
      Object.keys(requiredTables).sort(),
    );
  });

  it('gives each table the name better-auth queries', () => {
    const tableNames = modelsUnderContract.map(
      ({ definition, model, table }) => ({
        expected: `${model}: ${definition.modelName}`,
        actual: `${model}: ${getTableConfig(table).name}`,
      }),
    );
    expect(tableNames.map(({ actual }) => actual)).toEqual(
      tableNames.map(({ expected }) => expected),
    );
  });

  it('has a column for every field better-auth requires', () => {
    const missing = modelsUnderContract.flatMap(({ definition, table }) => {
      const columns = getTableColumns(table);
      const expectedColumns = [
        primaryKeyColumn,
        ...Object.entries(definition.fields).map(([fieldKey, field]) =>
          columnNameOf(fieldKey, field),
        ),
      ];
      return expectedColumns
        .filter((column) => columns[column] === undefined)
        .map((column) => `${definition.modelName}.${column}`);
    });
    expect(missing).toEqual([]);
  });

  it('stores every field in a column of the type better-auth writes', () => {
    const columnTypes = modelsUnderContract.flatMap(({ definition, table }) => {
      const columns = getTableColumns(table);
      return Object.entries(definition.fields).flatMap(([fieldKey, field]) => {
        const columnName = columnNameOf(fieldKey, field);
        const column = columns[columnName];
        const label = `${definition.modelName}.${columnName}`;
        return column === undefined
          ? []
          : [
              {
                expected: `${label}: ${expectedDataType(field)}`,
                actual: `${label}: ${column.dataType}`,
              },
            ];
      });
    });
    expect(columnTypes.map(({ actual }) => actual)).toEqual(
      columnTypes.map(({ expected }) => expected),
    );
  });

  it('marks every field better-auth requires as NOT NULL', () => {
    const nullable = modelsUnderContract.flatMap(({ definition, table }) => {
      const columns = getTableColumns(table);
      return Object.entries(definition.fields)
        .filter(([fieldKey, field]) => {
          const column = columns[columnNameOf(fieldKey, field)];
          return column !== undefined && isRequired(field) && !column.notNull;
        })
        .map(
          ([fieldKey, field]) =>
            `${definition.modelName}.${columnNameOf(fieldKey, field)}`,
        );
    });
    expect(nullable).toEqual([]);
  });
});
