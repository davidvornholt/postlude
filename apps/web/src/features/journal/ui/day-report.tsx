/**
 * The day's /wrap report, folded away until energy is rated.
 *
 * Energy is how the day felt, and it is rated before the report is read so
 * the numbers can't talk the feeling into something else. Progress comes after
 * the report, which is where the numbers help.
 *
 * Reading the report is often what starts the writing, so the open report ends
 * with a way straight back to the editor.
 */

import { useId, useState } from 'react';

import { Button } from '#/shared/ui/action.tsx';
import type { WrapArea } from '../schemas/agent-area.ts';
import { ReportFrame } from './report-frame.tsx';

type DayReportProps = {
  readonly wrap: WrapArea;
  /** Whether energy is rated, which is what opens the report. */
  readonly unlocked: boolean;
  readonly onBackToWriting: () => void;
};

const disabledQuietClass =
  'disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:text-ink-faint';

export const DayReport = ({
  wrap,
  unlocked,
  onBackToWriting,
}: DayReportProps) => {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const regionId = useId();
  const lockId = useId();
  const { reportHtml, dayMetrics, metricsVersion } = wrap;
  const heading = (
    <h3 className="font-display text-ink text-xl" id={headingId}>
      Day report
    </h3>
  );

  if (reportHtml === null || dayMetrics === null || metricsVersion === null) {
    return (
      <section aria-labelledby={headingId}>
        {heading}
        <p className="mt-2 text-ink-muted">
          There is no report for this day. /wrap writes one when it runs.
        </p>
      </section>
    );
  }

  const shown = open && unlocked;
  return (
    <section aria-labelledby={headingId}>
      {heading}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Button
          aria-controls={shown ? regionId : undefined}
          aria-describedby={unlocked ? undefined : lockId}
          aria-expanded={shown}
          className={disabledQuietClass}
          disabled={!unlocked}
          onClick={() => setOpen((current) => !current)}
          variant="quiet"
        >
          {shown ? 'Hide the report' : 'Show the report'}
        </Button>
        {shown ? (
          <Button onClick={onBackToWriting} variant="quiet">
            Back to writing
          </Button>
        ) : null}
        {wrap.reportModel === null ? null : (
          <p className="text-ink-faint text-sm">By {wrap.reportModel}</p>
        )}
      </div>
      {unlocked ? null : (
        <p className="mt-2 text-ink-muted" id={lockId}>
          Rate your energy first. The report opens once you have, so its numbers
          don’t sway how the day felt.
        </p>
      )}
      {shown ? (
        <div className="mt-4" id={regionId}>
          <ReportFrame
            dayMetrics={dayMetrics}
            metricsVersion={metricsVersion}
            reportHtml={reportHtml}
          />
          <Button className="mt-4" onClick={onBackToWriting} variant="quiet">
            Back to writing
          </Button>
        </div>
      ) : null}
    </section>
  );
};
