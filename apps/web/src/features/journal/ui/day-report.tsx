/**
 * The day's /wrap report, folded away until energy and progress are rated
 * (`evening-flow.tsx` says why). The open report ends with a way straight on
 * to the writing below it.
 *
 * The report and the line that says why it is locked both grow and shrink to
 * their height rather than appearing at once, so the writing below slides out
 * of the way instead of jumping. The report leaves the page once it is hidden,
 * so showing it again loads it afresh.
 *
 * The open report sits in the text column. Where the screen is wide enough for
 * more room to help its timeline, a control the report has beside its
 * timeline widens it and narrows it again (`report-frame.tsx` says how). The
 * browser remembers the choice (`report-width.ts`), so a report opens as wide
 * as the last one.
 */

import { useId, useState } from 'react';

import { Button } from '#/shared/ui/action.tsx';
import { Collapsible } from '#/shared/ui/collapsible.tsx';
import { browserReportWidthMemory, type ReportWidth } from '../report-width.ts';
import type { WrapArea } from '../schemas/agent-area.ts';
import { RowLabel } from './rating-scale.tsx';
import { ReportFrame } from './report-frame.tsx';

type DayReportProps = {
  readonly wrap: WrapArea;
  /** Whether energy and progress are rated, which is what opens the report. */
  readonly unlocked: boolean;
  readonly onToWriting: () => void;
};

const disabledQuietClass =
  'disabled:cursor-not-allowed disabled:text-ink-faint disabled:hover:text-ink-faint';

export const DayReport = ({ wrap, unlocked, onToWriting }: DayReportProps) => {
  const [open, setOpen] = useState(false);
  // Nothing that depends on the width is drawn before the report is shown, so
  // the server, which has no storage, draws the same page as the browser.
  const [width, setWidth] = useState<ReportWidth>(() =>
    browserReportWidthMemory().read(),
  );
  const headingId = useId();
  const regionId = useId();
  const lockId = useId();
  const { reportHtml, dayMetrics, metricsVersion } = wrap;
  const heading = (
    <RowLabel as="h3" id={headingId}>
      Day report
    </RowLabel>
  );
  const rowClass = 'flow-root py-3';

  if (reportHtml === null || dayMetrics === null || metricsVersion === null) {
    return (
      <section aria-labelledby={headingId} className={rowClass}>
        {heading}
        <p className="clear-left flow-root text-ink-muted sm:clear-none sm:py-2.5">
          There is no report for this day. /wrap writes one when it runs.
        </p>
      </section>
    );
  }

  const shown = open && unlocked;
  const changeWidth = (next: ReportWidth): void => {
    setWidth(next);
    browserReportWidthMemory().remember(next);
  };
  return (
    <section aria-labelledby={headingId} className={rowClass}>
      {heading}
      <div className="clear-left flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2 sm:clear-none">
        <Button
          aria-controls={regionId}
          aria-describedby={unlocked ? undefined : lockId}
          aria-expanded={shown}
          className={disabledQuietClass}
          disabled={!unlocked}
          onClick={() => setOpen((current) => !current)}
          variant="quiet"
        >
          {shown ? 'Hide the report' : 'Show the report'}
        </Button>
        {wrap.reportModel === null ? null : (
          <p className="text-ink-faint text-sm">By {wrap.reportModel}</p>
        )}
      </div>
      <Collapsible open={!unlocked} unmountWhenClosed={true}>
        <p className="mt-1 text-ink-muted text-sm sm:ml-44" id={lockId}>
          Rate energy and progress first. The report opens once both are rated.
        </p>
      </Collapsible>
      <Collapsible
        className="clear-both"
        id={regionId}
        open={shown}
        unmountWhenClosed={true}
      >
        <div className="pt-4">
          <ReportFrame
            dayMetrics={dayMetrics}
            metricsVersion={metricsVersion}
            onWidthRequest={changeWidth}
            reportHtml={reportHtml}
            wide={width === 'wide'}
          />
          <Button className="mt-4" onClick={onToWriting} variant="quiet">
            Go to the writing
          </Button>
        </div>
      </Collapsible>
    </section>
  );
};
