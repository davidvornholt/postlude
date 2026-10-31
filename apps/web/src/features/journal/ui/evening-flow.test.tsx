/**
 * What the day page renders under the evening's writing, before any script
 * runs: the ratings, the folded report, the closing and the agent note, in
 * each state the server can hand over.
 */

import { expect, it } from 'bun:test';

import {
  attributeValue,
  elementAttributes,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { notConfiguredMessage } from '../evening-messages.ts';
import type { AgentNoteView } from '../schemas/agent-area.ts';
import type { DayRating } from '../schemas/day-rating.ts';
import type { EveningView } from '../services/evening-fns.ts';
import {
  emptyEvening,
  noAgentNote,
  sampleDayMetrics,
} from '../testing/evening-view.ts';
import {
  entryOn,
  renderDay,
  renderDayWith,
  today,
} from './day-page-test-support.tsx';

const reportMarker = 'synthetic-report-body';
const closedAt = new Date('2026-08-26T21:00:00.000Z');

const eveningWith = ({
  rating = {},
  report = false,
  agentNote = {},
}: {
  readonly rating?: Partial<DayRating>;
  readonly report?: boolean;
  readonly agentNote?: Partial<AgentNoteView>;
} = {}): EveningView => {
  const empty = emptyEvening(today, 2);
  return {
    ...empty,
    rating: { ...empty.rating, ratingVersion: 1, ...rating },
    wrap: report
      ? {
          ...empty.wrap,
          dayMetrics: sampleDayMetrics(today),
          metricsVersion: 2,
          reportHtml: `<!doctype html><p>${reportMarker}</p>`,
          reportModel: 'Synthetic Model 1',
          reportGeneratedAt: closedAt,
        }
      : empty.wrap,
    agentNote: { ...noAgentNote(2), ...agentNote },
  };
};

const renderEvening = (
  evening: EveningView | undefined,
  journalMarkdown = '',
): Promise<string> =>
  renderDayWith(entryOn({ journalMarkdown, revision: 2 }), evening);

const buttonAttributes = (html: string, label: string): string =>
  elementAttributes(html, 'button', label);

const disabledAttribute = /\sdisabled=""/u;
const germanNote = /<p[^>]*lang="de"[^>]*>Ein &lt;b&gt;/u;
const englishNote = /<p[^>]*lang="en"[^>]*>A quiet day/u;

const isDisabled = (attributes: string): boolean =>
  disabledAttribute.test(attributes);

it('asks for energy first and keeps the closing shut until both ratings are in', async () => {
  const html = await renderEvening(eveningWith());
  const text = plainText(html);

  expect(text).toContain('Looking back');
  expect(text.indexOf('Energy')).toBeLessThan(text.indexOf('Day report'));
  expect(text.indexOf('Day report')).toBeLessThan(text.indexOf('Progress'));
  expect(text).toContain('Would you repeat this day?Optional.YesPartlyNo');
  expect(html.match(/type="radio"/gu)?.length).toBe(9);
  expect(html).not.toContain('checked=""');
  const close = buttonAttributes(html, 'Close the day');
  expect(isDisabled(close)).toBe(true);
  expect(text).toContain('Rate energy and progress to close the day.');
});

it('says plainly when /wrap has written no report for the day', async () => {
  const html = await renderEvening(eveningWith());

  expect(plainText(html)).toContain(
    'There is no report for this day. /wrap writes one when it runs.',
  );
  expect(buttonAttributes(html, 'Show the report')).toBe('');
});

it('keeps the report locked until energy is rated, with the reason beside it', async () => {
  const html = await renderEvening(eveningWith({ report: true }));
  const toggle = buttonAttributes(html, 'Show the report');

  expect(isDisabled(toggle)).toBe(true);
  expect(attributeValue(toggle, 'aria-expanded')).toBe('false');
  expect(plainText(html)).toContain('Rate your energy first.');
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain(reportMarker);
});

it('offers the report once energy is rated, still folded and with no numbers in the markup', async () => {
  const html = await renderEvening(
    eveningWith({ rating: { energy: 'okay' }, report: true }),
  );
  const toggle = buttonAttributes(html, 'Show the report');

  expect(isDisabled(toggle)).toBe(false);
  expect(plainText(html)).not.toContain('Rate your energy first.');
  expect(plainText(html)).toContain('By Synthetic Model 1');
  expect(html).not.toContain(reportMarker);
  expect(html).not.toContain('412');
  expect(plainText(html)).toContain('Rate progress to close the day.');
});

it('opens the closing once energy and progress are rated', async () => {
  const html = await renderEvening(
    eveningWith({ rating: { energy: 'fresh', progress: 'solid' } }),
  );

  expect(isDisabled(buttonAttributes(html, 'Close the day'))).toBe(false);
  expect(html.match(/checked=""/gu)?.length).toBe(2);
  expect(plainText(html)).not.toContain('to close the day.');
});

it('shows a closed day with its ratings held and a way to reopen it', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'fresh', progress: 'solid', closedAt },
      agentNote: { status: 'pending', requestedAt: closedAt },
    }),
  );
  const text = plainText(html);

  expect(text).toContain('This day is closed.');
  expect(buttonAttributes(html, 'Reopen the day')).not.toBe('');
  expect(buttonAttributes(html, 'Close the day')).toBe('');
  expect(html.match(/<fieldset[^>]*\sdisabled=""/gu)?.length).toBe(3);
  expect(text).toContain('An agent is writing a note on this day.');
});

it('marks the note as an agent’s, names the model and keeps it plain text in the entry’s language', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'okay', progress: 'little', closedAt },
      agentNote: {
        status: 'ready',
        note: 'Ein <b>ruhiger</b> Tag.',
        model: 'Synthetic Model 2',
        basedOnRevision: 2,
        generatedAt: closedAt,
      },
    }),
    'Ein ruhiger Tag.',
  );

  expect(plainText(html)).toContain('Written by an agent, Synthetic Model 2');
  expect(html).toContain('Ein &lt;b&gt;ruhiger&lt;/b&gt; Tag.');
  expect(html).not.toContain('<b>ruhiger</b>');
  expect(html).toMatch(germanNote);
  expect(buttonAttributes(html, 'Ask for a new note')).toBe('');
});

it('writes the note of an empty entry in English', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'okay', progress: 'little', closedAt },
      agentNote: {
        status: 'ready',
        note: 'A quiet day with nothing written.',
        model: 'Synthetic Model 2',
        basedOnRevision: 2,
      },
    }),
  );

  expect(html).toMatch(englishNote);
});

it('says when the writing moved past the note and offers a new one', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'okay', progress: 'little', closedAt },
      agentNote: {
        status: 'ready',
        note: 'An earlier note.',
        model: 'Synthetic Model 2',
        basedOnRevision: 1,
      },
    }),
  );

  expect(plainText(html)).toContain(
    'The writing changed after this note was written.',
  );
  expect(buttonAttributes(html, 'Ask for a new note')).not.toBe('');
});

it('words a note generator that is not set up calmly, as nothing wrong with the day', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'okay', progress: 'little', closedAt },
      agentNote: { status: 'failed', error: notConfiguredMessage },
    }),
  );
  const text = plainText(html);

  expect(text).toContain('Agent notes are not set up yet');
  expect(text).not.toContain(notConfiguredMessage);
  expect(buttonAttributes(html, 'Ask for a note')).not.toBe('');
});

it('gives the stored reason when a note could not be written', async () => {
  const html = await renderEvening(
    eveningWith({
      rating: { energy: 'okay', progress: 'little', closedAt },
      agentNote: { status: 'failed', error: 'The model took too long.' },
    }),
  );

  expect(plainText(html)).toContain('The model took too long.');
  expect(buttonAttributes(html, 'Ask for a new note')).not.toBe('');
});

it('keeps the writing usable when the evening could not be read', async () => {
  const html = await renderEvening(undefined);

  expect(plainText(html)).toContain(
    'The ratings, report and agent note could not be loaded. Your writing is not affected.',
  );
  expect(html).not.toContain('type="radio"');
});

it('waits for a day that has not begun', async () => {
  const html = await renderDay(entryOn({ date: '2026-08-27' }));

  expect(plainText(html)).toContain('This day has not begun yet.');
  expect(html).not.toContain('type="radio"');
});
