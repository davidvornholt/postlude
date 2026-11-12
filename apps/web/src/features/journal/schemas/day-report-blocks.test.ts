import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';

import {
  type ReportDocument,
  ReportDocumentSchema,
  unknownBlockKinds,
} from './day-report-blocks.ts';

const decodes = (value: unknown) =>
  Schema.decodeUnknownExit(ReportDocumentSchema)(value, {
    onExcessProperty: 'error',
  })._tag === 'Success';

const document: ReportDocument = {
  version: 1,
  blocks: [
    { kind: 'callout', tone: 'warning', text: ['Calendar was unreachable.'] },
    {
      kind: 'paragraph',
      text: [
        'Landed ',
        { emphasis: 'the parser' },
        ' after ',
        { code: 'bun test' },
        ' passed, see ',
        { link: 'the change', href: 'https://example.com/pull/1' },
        '.',
      ],
    },
    {
      kind: 'tiles',
      tiles: [
        { label: 'Active', value: { minutes: 312 } },
        { label: 'Mail sent', value: null },
        { label: 'Prompts', value: { count: 4 }, note: ['1 from the phone'] },
      ],
    },
    {
      kind: 'section',
      heading: 'The day in parts',
      blocks: [
        {
          kind: 'parts',
          parts: [
            {
              title: 'Morning',
              start: '2026-10-29T08:00:00+01:00',
              end: '2026-10-29T11:30:00+01:00',
              text: [['Mail, then a plan.']],
            },
          ],
        },
      ],
    },
    {
      kind: 'timeline',
      heading: 'Timeline',
      groups: [
        {
          title: 'Screen',
          rows: [
            {
              label: 'Code',
              total: { minutes: 90 },
              marks: [
                {
                  kind: 'screen',
                  start: '2026-10-29T08:00:00+01:00',
                  end: '2026-10-29T09:30:00+01:00',
                  minutes: 90,
                  apps: [{ name: 'Editor', minutes: 90 }],
                },
                {
                  kind: 'mail',
                  at: '2026-10-29T09:00:00+01:00',
                  mailbox: 'Work',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      kind: 'section',
      heading: 'Pull requests landed',
      note: '1 landed',
      collapsed: true,
      blocks: [
        {
          kind: 'list',
          items: [
            {
              text: ['Parser'],
              time: { at: '2026-10-29T10:00:00+01:00' },
              meta: 'demo #1',
            },
            { text: ['All day'], time: { allDay: true } },
          ],
        },
      ],
    },
    {
      kind: 'facts',
      items: [{ term: 'Output', details: [['One change.']] }],
    },
    {
      kind: 'table',
      caption: 'Sent mail',
      columns: ['Mailbox', 'Sent'],
      rows: [
        [['Work'], ['3']],
        [['Personal'], []],
      ],
    },
  ],
};

const withBlock = (block: unknown) => ({ version: 1, blocks: [block] });

const nested = (depth: number): unknown =>
  depth === 0
    ? { kind: 'paragraph', text: ['Deep.'] }
    : {
        kind: 'section',
        heading: `Level ${depth}`,
        blocks: [nested(depth - 1)],
      };

describe('the report document schema', () => {
  it('accepts a document with every kind of block', () => {
    expect(decodes(document)).toBe(true);
  });

  it('accepts only the version it reads', () => {
    expect(decodes({ ...document, version: 2 })).toBe(false);
    expect(decodes({ blocks: document.blocks })).toBe(false);
  });

  it('refuses a document without blocks and a key it does not know', () => {
    expect(decodes({ version: 1, blocks: [] })).toBe(false);
    expect(decodes({ ...document, html: '<p>Hi</p>' })).toBe(false);
    expect(
      decodes(withBlock({ kind: 'paragraph', text: ['Hi'], style: 'x' })),
    ).toBe(false);
  });

  it('nests sections three deep and no deeper', () => {
    expect(decodes(withBlock(nested(3)))).toBe(true);
    expect(decodes(withBlock(nested(4)))).toBe(false);
  });

  it('holds rich text to plain, emphasised, code, and http(s) links', () => {
    const paragraph = (span: unknown) =>
      withBlock({ kind: 'paragraph', text: [span] });
    expect(decodes(paragraph({ link: 'Ok', href: 'http://example.com' }))).toBe(
      true,
    );
    expect(
      decodes(paragraph({ link: 'Run', href: 'javascript:alert(1)' })),
    ).toBe(false);
    expect(
      decodes(paragraph({ link: 'Data', href: 'data:text/html,<b>x</b>' })),
    ).toBe(false);
    expect(decodes(paragraph({ link: 'Relative', href: '/days' }))).toBe(false);
    expect(decodes(paragraph({ html: '<b>bold</b>' }))).toBe(false);
    expect(decodes(paragraph({ emphasis: 'x', code: 'y' }))).toBe(false);
    expect(decodes(paragraph({ emphasis: ['nested'] }))).toBe(false);
    expect(decodes(paragraph(''))).toBe(false);
    expect(decodes(withBlock({ kind: 'paragraph', text: [] }))).toBe(false);
  });

  it('refuses a blank heading and a label that is rich text', () => {
    expect(
      decodes(
        withBlock({
          kind: 'section',
          heading: '  ',
          blocks: [{ kind: 'paragraph', text: ['Hi'] }],
        }),
      ),
    ).toBe(false);
    expect(
      decodes(
        withBlock({
          kind: 'tiles',
          tiles: [{ label: [{ emphasis: 'Active' }], value: null }],
        }),
      ),
    ).toBe(false);
  });

  it('wants a table row to have a cell for each column', () => {
    expect(
      decodes(
        withBlock({
          kind: 'table',
          columns: ['Mailbox', 'Sent'],
          rows: [[['Work']]],
        }),
      ),
    ).toBe(false);
  });

  it('wants times that are instants and spans that end after they start', () => {
    const part = (start: string, end: string) =>
      withBlock({
        kind: 'parts',
        parts: [{ title: 'Morning', start, end, text: [['Mail.']] }],
      });
    expect(
      decodes(part('2026-10-29T08:00:00+01:00', '2026-10-29T07:00:00+01:00')),
    ).toBe(false);
    expect(decodes(part('08:00', '09:00'))).toBe(false);
  });

  it('holds tile values to minutes, counts, or not measured', () => {
    const tile = (value: unknown) =>
      withBlock({ kind: 'tiles', tiles: [{ label: 'Active', value }] });
    expect(decodes(tile({ minutes: -1 }))).toBe(false);
    expect(decodes(tile({ count: 1.5 }))).toBe(false);
    expect(decodes(tile('5 h'))).toBe(false);
  });

  it('keeps a mail mark to its time, mailbox and subject', () => {
    const mail = (mark: unknown) =>
      withBlock({
        kind: 'timeline',
        heading: 'Timeline',
        groups: [{ title: 'Mail', rows: [{ label: 'Work', marks: [mark] }] }],
      });
    const sent = {
      kind: 'mail',
      at: '2026-10-29T09:00:00Z',
      mailbox: 'W',
      subject: 'Hello',
    };
    expect(decodes(mail(sent))).toBe(true);
    // Only the subject: never who it went to, nor a word of the message.
    expect(decodes(mail({ ...sent, to: 'Ann' }))).toBe(false);
    expect(decodes(mail({ ...sent, body: 'Dear Ann' }))).toBe(false);
  });
});

describe('naming the blocks Postlude does not know', () => {
  it('finds them at any depth, with their kind', () => {
    expect(
      unknownBlockKinds({
        version: 1,
        blocks: [
          { kind: 'paragraph', text: ['Hi'] },
          { kind: 'chart', series: [] },
          {
            kind: 'section',
            heading: 'More',
            blocks: [{ kind: 'paragraph', text: ['x'] }, { kind: 'map' }],
          },
        ],
      }),
    ).toEqual([
      'blocks[1] is a block of kind "chart"',
      'blocks[2].blocks[1] is a block of kind "map"',
    ]);
  });

  it('finds none in a document of known blocks, or in what is no document', () => {
    expect(unknownBlockKinds(document)).toEqual([]);
    expect(unknownBlockKinds('report')).toEqual([]);
    expect(unknownBlockKinds({ version: 1 })).toEqual([]);
  });
});
