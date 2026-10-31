import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { attributeValue, openingTag } from '#/shared/testing/rendered-html.ts';
import type { DayMetrics } from '../schemas/day-metrics.ts';
import { sampleDayMetrics } from '../testing/evening-view.ts';
import { unratedDay } from '../testing/review-view.ts';
import { ScreenTimeChart } from './screen-time-chart.tsx';

const minutesPerHour = 60;
const rectPattern = /<rect\b(?<attributes>[^>]*)>/gu;
const hourLabelPattern = />(?<hours>\d+) h</gu;

const renderDay = (changes: Partial<DayMetrics>) => {
  const html = renderToStaticMarkup(
    <ScreenTimeChart
      days={[
        {
          ...unratedDay('2026-10-27'),
          metrics: { ...sampleDayMetrics('2026-10-27'), ...changes },
        },
      ]}
      today="2026-10-30"
    />,
  );
  const plotHeight = Number(
    attributeValue(openingTag(html, 'svg'), 'viewBox').split(' ')[3],
  );
  const scaleMinutes =
    Math.max(
      ...Array.from(html.matchAll(hourLabelPattern), (match) =>
        Number(match.groups?.hours),
      ),
    ) * minutesPerHour;
  // The column under the day in focus is the one rect that is not a bar.
  const bars = Array.from(html.matchAll(rectPattern), (match) => {
    const attributes = match.groups?.attributes ?? '';
    const y = Number(attributeValue(attributes, 'y'));
    return {
      className: attributeValue(attributes, 'class'),
      top: y,
      bottom: y + Number(attributeValue(attributes, 'height')),
    };
  }).filter((bar) => bar.className !== 'fill-surface-sunken');
  const top = Math.min(...bars.map((bar) => bar.top));
  return {
    html,
    parts: bars.map((bar) => bar.className),
    extentInMinutes: ((plotHeight - top) / plotHeight) * scaleMinutes,
  };
};

describe('ScreenTimeChart', () => {
  it('draws every bar as tall as the day’s screen time', () => {
    // 412 minutes at the screen, 236 of them focused and 88 scattered.
    const underSplit = renderDay({});
    expect(underSplit.extentInMinutes).toBeCloseTo(412);
    expect(underSplit.parts).toEqual([
      'fill-primary',
      'fill-heat-q1',
      'fill-none stroke-primary',
    ]);
    expect(underSplit.html).toContain('1 h 28 min not split');

    const overSplit = renderDay({ scatteredMinutes: 300 });
    expect(overSplit.extentInMinutes).toBeCloseTo(412);
    expect(overSplit.parts).toEqual(['fill-none stroke-primary']);
  });
});
