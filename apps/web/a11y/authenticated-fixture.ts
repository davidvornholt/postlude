import type * as playwright from '@playwright/test';
import { createPool } from '@postlude/db/pool';
import { makeSignature } from 'better-auth/crypto';
import { env } from '../src/shared/env';

const ownerId = 'postlude-a11y-owner';
const entryDate = '2026-08-20';
const fixtureText = 'A quiet evening with time to listen.';

export const signInToRealJournal = async (
  page: playwright.Page,
): Promise<() => Promise<void>> => {
  const databaseUrl = env.DATABASE_URL;
  const secret = env.BETTER_AUTH_SECRET;
  const allowedId = env.GITHUB_ALLOWED_ACCOUNT_ID;
  const authUrl = env.BETTER_AUTH_URL;
  if (
    !(
      databaseUrl &&
      new URL(databaseUrl).pathname.endsWith('_a11y') &&
      secret &&
      allowedId &&
      authUrl
    )
  ) {
    throw new Error(
      'The isolated browser database and public auth fixture must be prepared first.',
    );
  }
  const pool = createPool(databaseUrl);
  const token = crypto.randomUUID();
  try {
    await pool.query(
      'insert into "user" (id,name,email) values ($1,$2,$3) on conflict (id) do nothing',
      [ownerId, 'Browser fixture', 'browser@example.test'],
    );
    await pool.query(
      'insert into account (id,issuer,account_id,provider_id,user_id) values ($1,$2,$3,$4,$5) on conflict (id) do nothing',
      [ownerId, 'https://github.com', allowedId, 'github', ownerId],
    );
    await pool.query(
      "insert into session (id,token,user_id,expires_at) values ($1,$2,$3,now()+interval '1 hour')",
      [token, token, ownerId],
    );
    await pool.query(
      `insert into entry (entry_date,journal_markdown,journal_word_count,journal_search_text,scripture_search_text,scripture_reference_search_text,search_token_text,search_projection_revision) values ($1,$2,8,$2,'','','a quiet evening with time to listen',1) on conflict (entry_date) do nothing`,
      [entryDate, fixtureText],
    );
    await page.context().addCookies([
      {
        name: 'better-auth.session_token',
        value: `${token}.${await makeSignature(token, secret)}`,
        url: authUrl,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  } catch (error) {
    await pool.query('delete from session where id=$1', [token]);
    throw error;
  } finally {
    await pool.end();
  }
  return async () => {
    const cleanup = createPool(databaseUrl);
    try {
      await cleanup.query('delete from session where id=$1', [token]);
    } finally {
      await cleanup.end();
    }
  };
};
