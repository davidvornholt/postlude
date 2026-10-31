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
  // The column under the day in focus is the one rect that is not a bar, and
  // SVG paints no rect without height.
  const bars = Array.from(html.matchAll(rectPattern), (match) => {
    const attributes = match.groups?.attributes ?? '';
    return {
      className: attributeValue(attributes, 'class'),
      top: Number(attributeValue(attributes, 'y')),
      height: Number(attributeValue(attributes, 'height')),
    };
  }).filter((bar) => bar.className !== 'fill-surface-sunken' && bar.height > 0);
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

    // A part shorter than the gap between parts is still painted.
    const wholeDay = renderDay({
      activeMinutes: 1440,
      focusMinutes: 700,
      scatteredMinutes: 720,
    });
    expect(wholeDay.extentInMinutes).toBeCloseTo(1440);
    expect(wholeDay.parts).toEqual([
      'fill-primary',
      'fill-heat-q1',
      'fill-none stroke-primary',
    ]);
    expect(wholeDay.html).toContain('20 min not split');
  });
});
