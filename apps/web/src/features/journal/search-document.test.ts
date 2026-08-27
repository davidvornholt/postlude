import { expect, it } from 'bun:test';

import { searchDocumentOf } from './search-document.ts';

it('projects only prose a search result can show', () => {
  const projected = searchDocumentOf({
    journalMarkdown:
      '[shown label](hidden-target) ![hidden image](hidden-file)\n```\nhidden code\n```',
    scriptureMarkdown: '<!-- hidden comment -->Visible morning.',
    scriptureReference: undefined,
  });
  expect(projected.journalText).toBe('shown label');
  expect(projected.scriptureText).toBe('Visible morning.');
  expect(projected.journalText).not.toContain('hidden');
});

it('normalizes visible prose and indexes every supported reference spelling', () => {
  const projected = searchDocumentOf({
    journalMarkdown: 'Spru\u0308che',
    scriptureMarkdown: '',
    scriptureReference: { book: 'Proverbs', chapter: 12, verseStart: 5 },
  });
  expect(projected.journalText).toBe('Sprüche');
  expect(projected.scriptureReferenceText).toContain('Proverbs 12:5');
  expect(projected.scriptureReferenceText).toContain('Sprüche 12:5');
  expect(projected.scriptureReferenceText).toContain('Sprueche 12:5');
  expect(projected.scriptureReferenceText).toContain('Spr 12:5');
});
