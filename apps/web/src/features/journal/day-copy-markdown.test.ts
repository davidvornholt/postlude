import { describe, expect, it } from 'bun:test';

import { dayCopyMarkdown } from './day-copy-markdown.ts';

describe('day copy Markdown', () => {
  it('copies the complete day as one readable Markdown document', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: 'Proverbs 12:5-13',
        scriptureMarkdown: 'A **clear** instruction.',
        journalMarkdown: 'The day ended with [rain](https://example.com).',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

Passage: Proverbs 12:5-13

A **clear** instruction.

## Evening

The day ended with [rain](https://example.com).
`);
  });

  it('keeps both parts of an otherwise empty day available for writing', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: '',
        scriptureMarkdown: '',
        journalMarkdown: '',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

## Evening
`);
  });

  it('keeps entry headings below the day and section headings', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: '',
        scriptureMarkdown: '# Morning thought\n\n## Detail',
        journalMarkdown: '# Evening thought\n\n###### Deepest note',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

### Morning thought

#### Detail

## Evening

### Evening thought

###### Deepest note
`);
  });

  it('preserves attachment references and fenced Markdown', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: '',
        scriptureMarkdown: [
          '# Morning thought',
          '',
          '![scan](attachments/scan.png)',
          '',
          '````md',
          '# Heading inside code',
          '```',
          '````',
        ].join('\n'),
        journalMarkdown: '',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

### Morning thought

![scan](attachments/scan.png)

\`\`\`\`md
# Heading inside code
\`\`\`
\`\`\`\`

## Evening
`);
  });

  it('nests setext and container headings without rewriting list fences', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: '',
        scriptureMarkdown: [
          'Morning thought',
          '==============',
          '',
          '> # Quoted thought',
          '',
          '- ## List thought',
          '',
          '- ```md',
          '  # Heading inside code',
          '  ```',
          '',
          '## After the code',
        ].join('\n'),
        journalMarkdown: '',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

### Morning thought

> ### Quoted thought

- #### List thought

- \`\`\`md
  # Heading inside code
  \`\`\`

#### After the code

## Evening
`);
  });

  it('does not treat container-looking lines inside a fence as closers', () => {
    expect(
      dayCopyMarkdown({
        date: '2026-08-26',
        scriptureReference: '',
        scriptureMarkdown: [
          '```md',
          '- ```',
          '# Heading inside code',
          '```',
          '## After the code',
        ].join('\n'),
        journalMarkdown: '',
      }),
    ).toBe(`# Wednesday, August 26, 2026

## Morning

\`\`\`md
- \`\`\`
# Heading inside code
\`\`\`
#### After the code

## Evening
`);
  });
});
