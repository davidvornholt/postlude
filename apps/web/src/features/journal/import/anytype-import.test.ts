import { expect, it } from 'bun:test';

import { parseAnytypeJournal } from './anytype-import.ts';

it('uses metadata dates and separates the two Anytype sections', () => {
  const result = parseAnytypeJournal([
    {
      path: '/export/2025-05-10.md',
      content: `---
Date: "2026-05-10"
Scripture: Sprüche 10,1-5
id: ignored
---
# 2025-05-10
## Quiet time
Morning prose
## Reflection
Evening prose
### Kept heading
More prose
`,
    },
  ]);

  expect(result.issues).toEqual([]);
  expect(result.records).toEqual([
    {
      date: '2026-05-10',
      journalMarkdown: 'Evening prose\n### Kept heading\nMore prose',
      scriptureMarkdown: 'Morning prose',
      scriptureReference: {
        book: 'Proverbs',
        chapter: 10,
        verseStart: 1,
        verseEnd: 5,
      },
      source: '/export/2025-05-10.md',
    },
  ]);
});

it('accepts a missing Reflection section as an empty journal', () => {
  const result = parseAnytypeJournal([
    {
      path: '/export/day.md',
      content: `---
Date: "2026-05-11"
---
# Day
## Quiet time
Only scripture prose
`,
    },
  ]);
  expect(result.issues).toEqual([]);
  expect(result.records[0]).toMatchObject({
    journalMarkdown: '',
    scriptureMarkdown: 'Only scripture prose',
  });
});
