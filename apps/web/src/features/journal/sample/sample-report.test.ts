import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';

import { readReportDocument, reportPlainText } from '../day-report-reader.ts';
import { shiftJournalDate } from '../journal-day.ts';
import { ReportDocumentSchema } from '../schemas/day-report-blocks.ts';
import { seededRandom } from './sample-random.ts';
import { sampleReportDocument } from './sample-report.ts';
import { sampleDayMetrics } from './sample-wrap.ts';

const days = 120;
const agentNote =
  /Agent time [\d h min]+ [\d h min]+ across \d+ threads · up to \d+ at once/u;
const firstDay = '2026-07-01';

const metricsOf = (index: number) => {
  const date = shiftJournalDate(firstDay, index);
  return sampleDayMetrics({
    random: seededRandom(index + 1),
    date,
    timeZone: index % 2 === 0 ? 'Europe/Berlin' : 'America/St_Johns',
    metricsVersion: index % 3 === 0 ? 1 : 2,
    unreachable: index % 5 === 0 ? ['calendar', 'mail'] : undefined,
  });
};

describe('the sample report', () => {
  it('is a document `agent-area put` would take, on every sample day', () => {
    for (let index = 0; index < days; index += 1) {
      const document = sampleReportDocument(metricsOf(index));
      const decoded = Schema.decodeUnknownExit(ReportDocumentSchema)(document, {
        onExcessProperty: 'error',
      });
      expect(decoded._tag).toBe('Success');
    }
  });

  it('is the same every time for the same day', () => {
    const metrics = metricsOf(7);
    expect(sampleReportDocument(metrics)).toEqual(
      sampleReportDocument(metrics),
    );
  });

  it('says it is sample data, and its agent time is the clock time agents ran', () => {
    const document = sampleReportDocument(metricsOf(3));
    const text = reportPlainText(readReportDocument(document));
    expect(text).toStartWith('Sample data for a preview.');
    expect(text).toMatch(agentNote);
    expect(text).not.toContain('Tracked time');
    expect(text).not.toContain('Time by category');
  });
});
