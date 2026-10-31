import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  attributeValue,
  openingTag,
  plainText,
} from '#/shared/testing/rendered-html.ts';
import { CategoryChart } from './category-chart.tsx';

const rowPattern = /<li\b[^>]*>(?<row>.*?)<\/li>/gsu;
const spanPattern = /<span\b[^>]*>(?<text>.*?)<\/span>/gsu;

const rows = (html: string) =>
  Array.from(html.matchAll(rowPattern), (match) => {
    const row = match.groups?.row ?? '';
    return {
      text: Array.from(row.matchAll(spanPattern), (span) =>
        plainText(span.groups?.text ?? ''),
      ),
      barWidth: attributeValue(openingTag(row, 'rect'), 'width'),
    };
  });

it('says a category nobody measured is not measured, and draws it no bar', () => {
  const html = renderToStaticMarkup(
    <CategoryChart
      categories={[
        { id: 'reading', label: 'Reading', minutes: 30, missing: 1 },
        { id: 'calls', label: 'Calls', minutes: 0, missing: 0 },
        { id: 'admin', label: 'Admin', minutes: null, missing: 2 },
      ]}
    />,
  );

  expect(rows(html)).toEqual([
    {
      text: ['Reading', '30 min, not measured on 1 day'],
      barWidth: '100',
    },
    { text: ['Calls', '0 min'], barWidth: '0' },
    { text: ['Admin', 'Not measured'], barWidth: '' },
  ]);
});
