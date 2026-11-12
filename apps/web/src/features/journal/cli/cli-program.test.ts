import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';

import type { WrapPut } from '../schemas/agent-area.ts';
import { checkWrap } from './cli-program.ts';

const day = '2026-10-29';

const wrap: WrapPut = {
  dayMetrics: {
    metricsVersion: 1,
    day,
    activeMinutes: 300,
    firstActivityAt: null,
    lastActivityAt: null,
    focusMinutes: null,
    scatteredMinutes: null,
    categories: [],
    offComputerMinutes: null,
    appointmentMinutes: null,
    appointmentOffScreenMinutes: null,
    landedPrs: 0,
    sentMails: [],
    coverage: [{ source: 'activitywatch', status: 'complete' }],
  },
  metricsVersion: 1,
  reportDocument: {
    version: 1,
    blocks: [{ kind: 'paragraph', text: ['The day.'] }],
  },
  reportModel: 'wrap-model',
};

const check = (stdin: string) =>
  Effect.runPromise(checkWrap(day, Effect.succeed(stdin)));

const refusal = (stdin: string) =>
  Effect.runPromise(
    checkWrap(day, Effect.succeed(stdin)).pipe(
      Effect.flip,
      Effect.map((error) => error.message),
    ),
  );

const withBlocks = (blocks: ReadonlyArray<unknown>) =>
  JSON.stringify({ ...wrap, reportDocument: { version: 1, blocks } });

describe('agent-area check', () => {
  it('says what put would store, without storing it', async () => {
    expect(await check(JSON.stringify(wrap))).toEqual({
      date: day,
      valid: true,
      metricsVersion: 1,
      reportDocumentVersion: 1,
      reportDocumentBytes: JSON.stringify(wrap.reportDocument).length,
    });
  });

  it('names a block of a kind Postlude does not draw, and the kinds it does', async () => {
    const message = await refusal(
      withBlocks([
        { kind: 'paragraph', text: ['Hi'] },
        {
          kind: 'section',
          heading: 'More',
          blocks: [{ kind: 'chart', series: [] }],
        },
      ]),
    );
    expect(message).toBe(
      'reportDocument has blocks this Postlude doesn\'t draw: blocks[1].blocks[0] is a block of kind "chart". It draws section, paragraph, parts, facts, list, callout, tiles, timeline, table.',
    );
  });

  it('says where a document breaks the schema', async () => {
    const message = await refusal(
      withBlocks([
        {
          kind: 'paragraph',
          text: [{ link: 'Run', href: 'javascript:alert(1)' }],
        },
      ]),
    );
    expect(message).toStartWith('stdin does not match the agent-area input: ');
    expect(message).toContain('reportDocument');
    expect(message).toContain('http or https URL');
  });

  it('refuses markup in place of a document', async () => {
    const message = await refusal(
      JSON.stringify({ ...wrap, reportDocument: '<p>The day.</p>' }),
    );
    expect(message).toStartWith('stdin does not match the agent-area input: ');
  });

  it('refuses input that is not JSON, and metrics for another day', async () => {
    expect(await refusal('<html>')).toBe('stdin is not a JSON document.');
    expect(
      await refusal(
        JSON.stringify({
          ...wrap,
          dayMetrics: { ...wrap.dayMetrics, day: '2026-10-30' },
        }),
      ),
    ).toContain('dayMetrics.day');
  });
});
