import { describe, expect, it } from 'bun:test';

import {
  readReportDocument,
  reportPlainText,
  tileValueText,
} from './day-report-reader.ts';

const paragraph = {
  kind: 'paragraph',
  text: ['Merged ', { code: 'parser' }],
} as const;

describe('reading a stored report document', () => {
  it('reads the blocks it knows as they are', () => {
    expect(readReportDocument({ version: 1, blocks: [paragraph] })).toEqual({
      blocks: [paragraph],
    });
  });

  it('shows a block of a later kind as its words, without its addresses or times', () => {
    expect(
      readReportDocument({
        version: 2,
        blocks: [
          paragraph,
          {
            kind: 'chart',
            title: 'Later',
            series: [
              { label: 'Code', at: '2026-10-29T09:00:00+01:00', value: 3 },
            ],
            source: { link: 'Data', href: 'https://example.com/data' },
          },
        ],
      }).blocks,
    ).toEqual([
      paragraph,
      { kind: 'fallback', lines: ['Later', 'Code', 'Data'] },
    ]);
  });

  it('joins rich text in a fallback into one line', () => {
    expect(
      readReportDocument({
        version: 1,
        blocks: [
          { kind: 'quote', text: ['A ', { emphasis: 'good' }, ' day.'] },
        ],
      }).blocks,
    ).toEqual([{ kind: 'fallback', lines: ['A good day.'] }]);
  });

  it('shows a known block that no longer passes its rules as its words', () => {
    expect(
      readReportDocument({
        version: 1,
        blocks: [
          {
            kind: 'callout',
            tone: 'alarm',
            text: ['Calendar was unreachable.'],
          },
        ],
      }).blocks,
    ).toEqual([{ kind: 'fallback', lines: ['Calendar was unreachable.'] }]);
  });

  it('keeps a section whose inner block it cannot read', () => {
    const [section] = readReportDocument({
      version: 1,
      blocks: [
        {
          kind: 'section',
          heading: 'More',
          blocks: [paragraph, { kind: 'map', place: 'Somewhere' }],
        },
      ],
    }).blocks;
    expect(section).toEqual({
      kind: 'section',
      heading: 'More',
      blocks: [paragraph, { kind: 'fallback', lines: ['Somewhere'] }],
    });
  });

  it('reads a section nested deeper than allowed as its words', () => {
    const deep = {
      kind: 'section',
      heading: 'One',
      blocks: [
        {
          kind: 'section',
          heading: 'Two',
          blocks: [
            {
              kind: 'section',
              heading: 'Three',
              blocks: [
                { kind: 'section', heading: 'Four', blocks: [paragraph] },
              ],
            },
          ],
        },
      ],
    };
    const read = readReportDocument({ version: 1, blocks: [deep] });
    expect(reportPlainText(read)).toBe('One Two Three Four Merged parser');
    expect(JSON.stringify(read)).toContain(
      '{"kind":"fallback","lines":["Four","Merged parser"]}',
    );
  });

  it('shows what is no document at all as one fallback', () => {
    expect(readReportDocument('<p>Old</p>')).toEqual({
      blocks: [{ kind: 'fallback', lines: ['<p>Old</p>'] }],
    });
    expect(readReportDocument(null)).toEqual({
      blocks: [{ kind: 'fallback', lines: [] }],
    });
  });
});

describe('a report as plain text', () => {
  it('reads every block in order, values formatted and links without addresses', () => {
    const read = readReportDocument({
      version: 1,
      blocks: [
        {
          kind: 'paragraph',
          text: [
            'See ',
            { link: 'the change', href: 'https://example.com/pull/1' },
          ],
        },
        {
          kind: 'tiles',
          tiles: [
            { label: 'Active', value: { minutes: 125 } },
            { label: 'Mail sent', value: null, note: ['Mail was unreachable'] },
          ],
        },
        {
          kind: 'section',
          heading: 'Pull requests',
          note: '1 landed',
          blocks: [
            {
              kind: 'list',
              items: [{ text: ['Parser'], meta: 'demo #1' }],
            },
          ],
        },
        {
          kind: 'table',
          columns: ['Mailbox', 'Sent'],
          rows: [[['Work'], ['3']]],
        },
      ],
    });
    expect(reportPlainText(read)).toBe(
      'See the change Active 2 h 5 min Mail sent Not measured Mail was unreachable Pull requests 1 landed Parser demo #1 Mailbox Sent Work 3',
    );
  });

  it("leaves a timeline's cards out, so search never finds a window title or a mail subject", () => {
    const at = (clock: string) => `2026-10-29T${clock}:00+01:00`;
    const read = readReportDocument({
      version: 1,
      blocks: [
        {
          kind: 'timeline',
          heading: 'Timeline',
          notes: ['Mail was read from one mailbox'],
          groups: [
            {
              title: 'Screen time',
              rows: [
                {
                  label: 'Code',
                  marks: [
                    {
                      kind: 'screen',
                      start: at('09:00'),
                      end: at('10:00'),
                      minutes: 60,
                      threads: ['Parser refactor'],
                      apps: [{ name: 'Editor', minutes: 60 }],
                      windows: ['Notes - Editor'],
                    },
                  ],
                },
              ],
            },
            {
              title: 'Landed and sent',
              rows: [
                {
                  label: 'Sent mail',
                  marks: [
                    {
                      kind: 'mail',
                      at: at('11:00'),
                      mailbox: 'Work',
                      subject: 'Garden plan',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(reportPlainText(read)).toBe(
      'Timeline Mail was read from one mailbox',
    );
  });

  it('folds compatibility forms and white space', () => {
    expect(
      reportPlainText({
        blocks: [
          { kind: 'paragraph', text: ['ﬁne\n\n  work'] },
          { kind: 'fallback', lines: ['Later'] },
        ],
      }),
    ).toBe('fine work Later');
  });
});

describe('a tile value as text', () => {
  it('formats minutes and counts and names what was not measured', () => {
    expect(tileValueText({ minutes: 45 })).toBe('45 min');
    expect(tileValueText({ count: 3 })).toBe('3');
    expect(tileValueText(null)).toBe('Not measured');
  });
});
