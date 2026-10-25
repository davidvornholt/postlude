import { expect, test } from '@playwright/test';
import { createPool } from '@postlude/db/connections';
import { env } from '../src/shared/env';
import { signInToRealJournal } from './authenticated-fixture.ts';

/*
 * This runs against the real app rather than the hydrated day-page fixture.
 * The fixture's server markup does not match its client router, so React
 * renders it afresh and never takes the hydration path this test is about.
 */

const storedText = 'Stored evening text.';
const recoveredText = 'Stored evening text. Words the server never confirmed.';
const addedText = ' Written after the reload.';

// Tests running at the same time share one database, so each worker slot
// writes its own day. No other browser test writes a day in July 2026.
const dayFor = (parallelIndex: number): string =>
  `2026-07-${String(parallelIndex + 1).padStart(2, '0')}`;

test('a draft kept in the tab opens in the editor and the next edit keeps it', async ({
  page,
}, testInfo) => {
  const date = dayFor(testInfo.parallelIndex);
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl === undefined) {
    throw new Error('The isolated browser database must be prepared first.');
  }
  const pool = createPool(databaseUrl);
  const storedJournal = async (): Promise<string | undefined> => {
    const { rows } = await pool.query<{ journalMarkdown: string }>(
      'select journal_markdown as "journalMarkdown" from entry where entry_date=$1',
      [date],
    );
    return rows[0]?.journalMarkdown;
  };
  const forgetDay = () =>
    pool.query('delete from entry where entry_date=$1', [date]);
  await forgetDay();
  const signOut = await signInToRealJournal(page);
  try {
    await page.goto(`/day/${date}`);
    const evening = page.getByRole('textbox', { name: 'Evening journal' });
    await evening.focus();
    await page.keyboard.type(storedText);
    await page.keyboard.press('Tab');
    await expect.poll(storedJournal).toBe(storedText);

    // A failed save leaves this copy in the tab. It is written as the next
    // document starts, because leaving a saved page clears the tab's copy.
    await page.addInitScript(
      ({ key, draft }) => {
        if (globalThis.sessionStorage.getItem('draft-recovery-seeded')) {
          return;
        }
        globalThis.sessionStorage.setItem('draft-recovery-seeded', 'true');
        globalThis.sessionStorage.setItem(key, JSON.stringify(draft));
      },
      {
        key: `postlude:journal-draft:v1:${date}`,
        draft: {
          date,
          journalMarkdown: recoveredText,
          scriptureMarkdown: '',
          scriptureReference: '',
          baseRevision: 1,
        },
      },
    );
    await page.reload();
    await expect.poll(storedJournal).toBe(recoveredText);

    await evening.focus();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(addedText);
    await page.keyboard.press('Tab');
    await expect.poll(storedJournal).toBe(`${recoveredText}${addedText}`);
    await expect(evening).toHaveText(`${recoveredText}${addedText}`);
  } finally {
    await signOut();
    await forgetDay();
    await pool.end();
  }
});
