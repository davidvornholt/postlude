import { describe, expect, it } from 'bun:test';

import {
  axisLabelsOf,
  axisOf,
  dividersOf,
  labelSpacingPx,
  labelStepOf,
  legendOf,
  nearestMarkOf,
  placeOf,
  walkOrderOf,
} from './day-report-timeline-layout.ts';
import type {
  TimelineBlock,
  TimelineRow,
} from './schemas/day-report-timeline.ts';

const at = (clock: string) => `2026-10-29T${clock}:00+01:00`;

const parts: TimelineRow = {
  label: 'Parts',
  marks: [
    { kind: 'part', number: 1, start: at('08:10'), end: at('11:00') },
    {
      kind: 'part',
      number: 2,
      title: 'Parser',
      start: at('11:00'),
      end: at('16:40'),
    },
  ],
};

const code: TimelineRow = {
  label: 'Code',
  total: { minutes: 150 },
  marks: [
    {
      kind: 'screen',
      start: at('09:00'),
      end: at('11:30'),
      minutes: 150,
      apps: [
        { name: 'Editor', minutes: 120 },
        { name: 'Terminal', minutes: 30 },
      ],
    },
  ],
};

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

const events: TimelineRow = {
  label: 'Landed and sent',
  marks: [
    {
      kind: 'pullRequest',
      at: at('12:31'),
      repository: 'demo',
      number: 7,
      title: 'Parser',
    },
    { kind: 'mail', at: at('13:15'), mailbox: 'Work' },
  ],
};

const block: TimelineBlock = {
  kind: 'timeline',
  heading: 'Timeline',
  groups: [
    { title: 'The day', rows: [parts] },
    { title: 'Screen', rows: [code] },
    { title: 'Agents', rows: [thread, events] },
  ],
};

const axis = axisOf(block);
if (axis === undefined) {
  throw new Error('The timeline has marks, so it has an axis.');
}

describe('the timeline axis', () => {
  it('runs in whole hours of the day’s clock around every mark', () => {
    expect(axis).toEqual({
      start: Date.parse(at('08:00')),
      end: Date.parse(at('17:00')),
      hours: 9,
      offsetMinutes: 60,
    });
  });

  it('is an hour long for a single moment, and missing without marks', () => {
    expect(
      axisOf({
        ...block,
        groups: [
          {
            title: 'Mail',
            rows: [
              {
                label: 'Work',
                marks: [{ kind: 'mail', at: at('13:00'), mailbox: 'Work' }],
              },
            ],
          },
        ],
      })?.hours,
    ).toBe(1);
    expect(
      axisOf({
        ...block,
        groups: [{ title: 'Empty', rows: [{ label: 'None', marks: [] }] }],
      }),
    ).toBeUndefined();
  });

  it('places marks in percent of the axis, and moments without a width', () => {
    const [screen] = code.marks;
    const [, prompt] = thread.marks;
    const place = screen === undefined ? undefined : placeOf(screen, axis);
    expect(place?.left).toBeCloseTo((1 / 9) * 100);
    expect(place?.width).toBeCloseTo((2.5 / 9) * 100);
    expect(prompt && placeOf(prompt, axis).width).toBeUndefined();
  });

  it('draws a divider where each part after the first begins', () => {
    expect(dividersOf(block, axis)).toEqual([(3 / 9) * 100]);
  });

  it('labels the hours that are multiples of the step', () => {
    expect(axisLabelsOf(axis, 3).map(({ text }) => text)).toEqual([
      '09:00',
      '12:00',
      '15:00',
    ]);
    expect(axisLabelsOf(axis, 1)).toHaveLength(9);
  });

  it('labels an hour twice when the day runs past it, so the labels are keyed by place', () => {
    const longDay = axisOf({
      kind: 'timeline',
      heading: 'Timeline',
      groups: [
        {
          title: 'Screen time',
          rows: [
            {
              label: 'Code',
              marks: [
                {
                  kind: 'screen',
                  start: at('04:00'),
                  end: '2026-10-30T04:30:00+01:00',
                  minutes: 1470,
                },
              ],
            },
          ],
        },
      ],
    });
    const texts = longDay
      ? axisLabelsOf(longDay, 4).map(({ text }) => text)
      : [];
    expect(texts.at(0)).toBe('04:00');
    expect(texts.at(-1)).toBe('04:00');
  });
});

describe('the axis labels at a width', () => {
  it('labels every hour where there is room', () => {
    expect(labelStepOf(9, 900)).toBe(1);
  });

  it('thins out so labels never come closer than their spacing, down to a phone', () => {
    for (const hours of [1, 6, 9, 15, 18, 24]) {
      for (const width of [120, 200, 240, 280, 343, 600, 1200, 2400]) {
        const step = labelStepOf(hours, width);
        const shown = Math.ceil(hours / step);
        const gap = (width / hours) * step;
        expect(24 % step).toBe(0);
        expect(shown <= 1 || gap >= labelSpacingPx).toBe(true);
      }
    }
  });
});

describe('the legend', () => {
  it('names the kinds of mark the timeline holds, pull requests and mail among them', () => {
    expect(legendOf(block).map(([kind]) => kind)).toEqual([
      'screen',
      'run',
      'phonePrompt',
      'pullRequest',
      'mail',
    ]);
  });
});

describe('finding a mark', () => {
  it('walks a row by time', () => {
    expect(walkOrderOf(thread.marks)).toEqual([1, 0]);
  });

  it('finds a moment within reach first, then the span under the point, then the nearest span', () => {
    const places = [
      { left: 10, width: 30 },
      { left: 20 },
      { left: 60 },
      { left: 70, width: 5 },
      { left: 80, width: 1.5 },
      { left: 80 },
    ];
    expect(nearestMarkOf(places, 20.4, 1)).toBe(1);
    expect(nearestMarkOf(places, 30, 1)).toBe(0);
    expect(nearestMarkOf(places, 59.5, 1)).toBe(2);
    expect(nearestMarkOf(places, 75.5, 1)).toBe(3);
    expect(nearestMarkOf(places, 50, 1)).toBeUndefined();
    // On a span a moment wins only within half the reach, so a short run that
    // begins with its prompt can be found along the rest of it.
    expect(nearestMarkOf(places, 20.8, 1)).toBe(0);
    expect(nearestMarkOf(places, 80.3, 1)).toBe(5);
    expect(nearestMarkOf(places, 81, 1)).toBe(4);
    expect(nearestMarkOf(places, 79.5, 1)).toBe(5);
  });
});
