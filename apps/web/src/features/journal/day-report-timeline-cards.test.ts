import { describe, expect, it } from 'bun:test';

import { cardOf, cardText } from './day-report-timeline-cards.ts';
import type {
  TimelineMark,
  TimelineRow,
} from './schemas/day-report-timeline.ts';

const at = (clock: string) => `2026-10-29T${clock}:00+01:00`;

const cardFor = (row: TimelineRow, index = 0) =>
  cardOf(row.marks[index] as TimelineMark, row);

const rowOf = (label: string, marks: TimelineRow['marks']): TimelineRow => ({
  label,
  marks,
});

describe('a screen-time card', () => {
  it('gives the stretch, its minutes on screen, the project, the threads prompted in it, the apps and the windows, and that it counted as focus', () => {
    const code = rowOf('Code', [
      {
        kind: 'screen',
        start: at('09:00'),
        end: at('11:30'),
        minutes: 150,
        projects: ['demo'],
        threads: ['Parser refactor', 'Tidy tests'],
        moreThreads: 2,
        apps: [
          { name: 'Editor', minutes: 120 },
          { name: 'Terminal', minutes: 30 },
        ],
        windows: ['Notes - Editor', 'Build - Terminal'],
        focus: {
          status: 'counted',
          start: at('09:00'),
          end: at('11:30'),
          minutes: 150,
        },
      },
    ]);
    expect(cardFor(code)).toEqual({
      title: 'Screen time · Code',
      lines: [
        '09:00–11:30 · 2 h 30 min on screen',
        'Focus: 2 h 30 min at the computer without a break of 2 min or more',
        'Project: demo',
        'Prompted in: Parser refactor, Tidy tests and 2 more',
        'Apps: Editor 2 h, Terminal 30 min',
        'Windows: Notes - Editor; Build - Terminal',
      ],
    });
  });

  it('shows the minutes on screen within a stretch whose bar joins a short break', () => {
    const code = rowOf('Code', [
      {
        kind: 'screen',
        start: at('08:00'),
        end: at('11:30'),
        minutes: 209,
        projects: ['demo', 'other'],
        focus: {
          status: 'counted',
          start: at('08:00'),
          end: at('11:30'),
          minutes: 209,
        },
      },
    ]);
    expect(cardFor(code).lines.slice(0, 3)).toEqual([
      '08:00–11:30 · 3 h 29 min of 3 h 30 min on screen',
      'Focus: 3 h 29 min at the computer without a break of 2 min or more',
      'Projects: demo, other',
    ]);
  });

  it('says when only part of the stretch counted as focus', () => {
    const code = rowOf('Code', [
      {
        kind: 'screen',
        start: at('09:00'),
        end: at('11:30'),
        minutes: 150,
        focus: {
          status: 'counted',
          start: at('10:00'),
          end: at('11:30'),
          minutes: 90,
        },
      },
    ]);
    expect(cardFor(code).lines[1]).toBe(
      'Focus from 10:00–11:30: 1 h 30 min at the computer without a break of 2 min or more',
    );
  });

  it('says why a stretch did not count as focus', () => {
    const notFocus = (
      focus: Extract<TimelineMark, { kind: 'screen' }>['focus'],
    ) =>
      cardFor(
        rowOf('Mail', [
          {
            kind: 'screen',
            start: at('11:30'),
            end: at('11:48'),
            minutes: 18,
            ...(focus === undefined ? {} : { focus }),
          },
        ]),
      ).lines.slice(1);
    expect(notFocus({ status: 'short', minutes: 18, needs: 25 })).toEqual([
      'Not focus: 18 min at the computer without a break of 2 min or more, and focus needs 25 min',
    ]);
    expect(notFocus({ status: 'noArea' })).toEqual([
      'Not focus: time in no area never counts',
    ]);
    expect(notFocus({ status: 'notCounted', within: 'Code' })).toEqual([
      'Not focus: its start counted toward focus in Code',
    ]);
    expect(notFocus({ status: 'notCounted' })).toEqual([
      'Not counted as focus',
    ]);
    // A converted report's stretch says nothing about focus.
    expect(notFocus(undefined)).toEqual([]);
  });
});

describe('the other cards', () => {
  const thread: TimelineRow = {
    label: 'Parser refactor',
    note: 'demo',
    marks: [
      {
        kind: 'run',
        start: at('11:00'),
        end: at('12:30'),
        pullRequests: [{ repository: 'demo', number: 7, title: 'Parser' }],
      },
      { kind: 'prompt', at: at('10:58'), fromPhone: true },
    ],
  };

  it('says how long a focus block was at the computer, and in which area', () => {
    const focus = rowOf('Code', [
      { kind: 'focus', start: at('08:00'), end: at('11:30'), minutes: 209 },
      { kind: 'focus', start: at('14:00'), end: at('15:00') },
    ]);
    expect(cardFor(focus)).toEqual({
      title: 'Focus · Code',
      lines: ['08:00–11:30 · 3 h 29 min at the computer'],
    });
    // A converted report's block without its minutes gives its length.
    expect(cardFor(focus, 1).lines).toEqual(['14:00–15:00 · 1 h']);
  });

  it('says what a pull request is, what it changed, and when it landed', () => {
    const events = rowOf('Pull requests', [
      {
        kind: 'pullRequest',
        at: at('12:31'),
        repository: 'demo',
        number: 7,
        title: 'Parser',
        summary: 'The parser now reads dates.',
      },
    ]);
    expect(cardFor(events)).toEqual({
      title: 'demo #7',
      lines: ['Parser', 'The parser now reads dates.', 'Landed at 12:31'],
    });
  });

  it('says when a mail was sent, from which mailbox, and its subject', () => {
    const mail = rowOf('Sent mail', [
      {
        kind: 'mail',
        at: at('13:15'),
        mailbox: 'Work',
        subject: 'Garden plan',
      },
    ]);
    expect(cardFor(mail)).toEqual({
      title: 'Mail sent',
      lines: ['13:15 · Work', 'Garden plan'],
    });
  });

  it('says when an agent ran, for how long, and what its thread landed', () => {
    expect(cardFor(thread)).toEqual({
      title: 'Agent running · Parser refactor · demo',
      lines: ['11:00–12:30 · 1 h 30 min', 'Landed demo #7: Parser'],
    });
  });

  it('leaves out what an older report did not keep', () => {
    const older = rowOf('Landed and sent', [
      {
        kind: 'pullRequest',
        at: at('12:31'),
        repository: 'demo',
        title: 'Parser',
      },
      { kind: 'mail', at: at('13:15') },
      { kind: 'screen', start: at('09:00'), end: at('10:00'), minutes: 60 },
    ]);
    expect(cardFor(older, 0)).toEqual({
      title: 'demo',
      lines: ['Parser', 'Landed at 12:31'],
    });
    expect(cardFor(older, 1).lines).toEqual(['13:15']);
    expect(cardFor(older, 2).lines).toEqual(['09:00–10:00 · 1 h on screen']);
  });

  it('names a part and a prompt from the phone', () => {
    const parts = rowOf('Parts', [
      { kind: 'part', number: 1, start: at('08:10'), end: at('11:00') },
      {
        kind: 'part',
        number: 2,
        title: 'Parser',
        start: at('11:00'),
        end: at('16:40'),
      },
    ]);
    expect(cardFor(parts, 1).title).toBe('Part 2 · Parser');
    expect(cardFor(parts, 0).title).toBe('Part 1');
    expect(cardText(cardFor(thread, 1))).toBe(
      'Prompt from the phone. 10:58 · Parser refactor · demo',
    );
  });
});
