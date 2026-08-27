import { expect, it } from 'bun:test';

import { searchDocumentOf } from './search-document.ts';

it('projects everything the Markdown reader shows and no hidden target', () => {
  const projected = searchDocumentOf({
    journalMarkdown:
      '[shown label](hidden-target) ![hidden image](hidden-file)\n```\nhidden code\n```',
    scriptureMarkdown: '<!-- hidden comment -->Visible morning.',
    scriptureReference: undefined,
  });
  expect(projected.journalText).toBe('shown label hidden image\nhidden code');
  expect(projected.scriptureText).toBe(
    '<!-- hidden comment -->Visible morning.',
  );
  expect(projected.journalText).not.toContain('hidden-target');
  expect(projected.journalText).not.toContain('hidden-file');
});

it('keeps exact visible prose and indexes every supported reference spelling', () => {
  const projected = searchDocumentOf({
    journalMarkdown: 'Spru\u0308che',
    scriptureMarkdown: '',
    scriptureReference: { book: 'Proverbs', chapter: 12, verseStart: 5 },
  });
  expect(projected.journalText).toBe('Spru\u0308che');
  expect(projected.scriptureReferenceText).toContain('Proverbs 12:5');
  expect(projected.scriptureReferenceText).toContain('Sprüche 12:5');
  expect(projected.scriptureReferenceText).toContain('Sprueche 12:5');
  expect(projected.scriptureReferenceText).toContain('Spr 12:5');
  expect(projected.searchTokenText).toContain('sprüche');
  expect(projected.searchTokenText).toContain('sprueche');
});

it('follows the parser for nested, reference, escaped and malformed links', () => {
  const projected = searchDocumentOf({
    journalMarkdown: `[outer [nested]](https://hidden.example/nested)

[reference label][entry]

<https://visible.example/a.b?q=1>

\\[escaped](visible-literal)

[malformed](

\`inline code\`

[entry]: https://hidden.example/reference`,
    scriptureMarkdown: '',
    scriptureReference: undefined,
  });
  expect(projected.journalText).toBe(`outer [nested]
reference label
https://visible.example/a.b?q=1
[escaped](visible-literal)
[malformed](
inline code`);
  expect(projected.journalText).not.toContain('hidden.example');
  expect(projected.searchTokenText).toContain('visible example a b q 1');
});
