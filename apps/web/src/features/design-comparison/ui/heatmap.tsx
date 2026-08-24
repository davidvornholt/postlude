/**
 * The year of journal activity, drawn once for both themes.
 *
 * It carries no colours or faces of its own: every fill is a semantic heat
 * utility, so the theme wrapper the page sits in decides what it looks like.
 *
 * Two rules from the data side shape the markup. The ramp is sequential — one
 * hue getting darker with the word count — so a cell can only be compared with
 * its neighbours if the surface shows between them, which is what the gap
 * between cells is for. And a day with no entry is not a paler day of writing,
 * so it is drawn as an outline rather than as the lightest step of the ramp.
 *
 * The grid is one image to a screen reader rather than 371 unlabelled cells:
 * the summary says what the picture says, and the page prints the streaks and
 * the total beside it, so nothing here is known by colour alone.
 */

import type {
  HeatLevel,
  JournalDay,
} from '#/features/design-comparison/archive-data.ts';

import {
  activitySummary,
  heatmapWeeks,
  monthColumnLabels,
  weekdayRows,
} from './heatmap-layout.ts';

const cellClass: Record<HeatLevel, string> = {
  // A hairline, not a fill: "nothing written" has to read as a different kind
  // of thing from "a little written", not as less of it.
  none: 'size-3 border border-border bg-heat-none',
  q1: 'size-3 bg-heat-q1',
  q2: 'size-3 bg-heat-q2',
  q3: 'size-3 bg-heat-q3',
  q4: 'size-3 bg-heat-q4',
};

const legendSteps = ['none', 'q1', 'q2', 'q3', 'q4'] as const;

const hintClass = 'flex h-3 items-center text-ink-faint text-xs leading-none';
// Month names sit over the column their month starts in and run past it, so the
// column keeps the cell's width and the name stays where it belongs.
const monthLabelClass =
  'h-4 w-3 whitespace-nowrap text-ink-faint text-xs leading-4';

export const ActivityHeatmap = ({
  days,
}: {
  readonly days: ReadonlyArray<JournalDay>;
}) => {
  const weeks = heatmapWeeks(days);
  const labels = monthColumnLabels(weeks);
  const columns = weeks.map((cells, week) => ({
    cells,
    label: labels[week] ?? '',
    start: cells[0]?.date ?? '',
  }));

  return (
    <figure className="m-0">
      <section
        aria-label="Journal activity grid"
        className="overflow-x-auto pb-1 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the grid is wider than a phone, so it scrolls, and a scrolling region has to be a tab stop or there is no way to reach the far end of the year without a mouse (WCAG 2.1.1).
        tabIndex={0}
      >
        <div className="flex w-max gap-2">
          <div aria-hidden="true" className="flex shrink-0 flex-col gap-0.5">
            <span className="block h-4" />
            {weekdayRows.map((row) => (
              <span className={hintClass} key={row.name}>
                {row.hint}
              </span>
            ))}
          </div>
          <div
            aria-label={activitySummary(days)}
            className="flex gap-0.5"
            role="img"
          >
            {columns.map((column) => (
              <div className="flex flex-col gap-0.5" key={column.start}>
                <span aria-hidden="true" className={monthLabelClass}>
                  {column.label}
                </span>
                {column.cells.map((cell) => (
                  <div
                    aria-hidden="true"
                    className={cellClass[cell.level]}
                    key={cell.date}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
      <figcaption className="mt-3 flex items-center gap-1 text-ink-faint text-xs">
        <span className="mr-1">Less</span>
        {legendSteps.map((step) => (
          <span aria-hidden="true" className={cellClass[step]} key={step} />
        ))}
        <span className="ml-1">More</span>
      </figcaption>
    </figure>
  );
};
