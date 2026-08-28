/**
 * The year of journal activity, as a square for every day.
 *
 * Two rules from the data side shape the markup. The ramp is sequential, so a
 * square can only be compared with its neighbours if the ground shows between
 * them, which is what the gap is for. And a day with nothing written is not a
 * paler day of writing, so it is drawn as an outline rather than as the
 * lightest step of the ramp.
 *
 * The grid is one image to a screen reader rather than 371 unlabelled squares,
 * described by a monthly breakdown that keeps every gap and every volume the
 * picture carries. It is deliberately not a field of links: 371 of them in the
 * tab order would put the whole year between the writer and the next thing on
 * the page. The chart stays one keyboard stop. Arrow keys select a day and
 * Enter opens it; pointer users can open the square under them. The table below
 * remains the prose alternative for every day written.
 */

import { useNavigate } from '@tanstack/react-router';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefCallback,
  useId,
} from 'react';

import { eyebrowClass, focusRingClass } from '#/shared/ui/design-classes.ts';
import type { HeatLevel } from '../activity.ts';
import { type ActivityCell, activityWeeks } from '../activity-cells.ts';
import {
  activityDayDetails,
  activityDescription,
  activitySummary,
  monthColumnLabels,
  weekdayRows,
} from '../activity-labels.ts';
import { type JournalDate, journalDateWeekday } from '../journal-day.ts';
import { ActivityTable } from './activity-table.tsx';
import {
  type ActivityDayCell,
  useActivitySelection,
} from './use-activity-selection.ts';

const cellClass: Record<HeatLevel, string> = {
  // A hairline, not a fill: "nothing written" has to read as a different kind
  // of thing from "a little written", not as less of it.
  none: 'size-3 border border-heat-none-mark bg-heat-none',
  q1: 'size-3 bg-heat-q1',
  q2: 'size-3 bg-heat-q2',
  q3: 'size-3 bg-heat-q3',
  q4: 'size-3 bg-heat-q4',
};

const legendSteps = ['q1', 'q2', 'q3', 'q4'] as const;

const hintClass = 'flex h-3 items-center text-ink-faint text-xs leading-none';
// A month's name sits over the column its month starts in and runs past it, so
// the column keeps the square's width and the name stays where it belongs.
const monthLabelClass =
  'h-4 w-3 whitespace-nowrap text-ink-faint text-xs leading-4';

type ActivityMapProps = {
  readonly cells: ReadonlyArray<ActivityCell>;
  readonly today: JournalDate;
};

type ActivityWeekProps = {
  readonly activeDate: JournalDate | undefined;
  readonly label: string;
  readonly registerCell: (date: JournalDate) => RefCallback<HTMLDivElement>;
  readonly setActiveDate: (date: JournalDate) => void;
  readonly today: JournalDate;
  readonly week: ReadonlyArray<ActivityCell>;
};

const ActivityWeek = ({
  activeDate,
  label,
  registerCell,
  setActiveDate,
  today,
  week,
}: ActivityWeekProps) => (
  <div className="flex flex-col gap-0.5">
    <span aria-hidden="true" className={monthLabelClass}>
      {label}
    </span>
    {weekdayRows
      .slice(0, journalDateWeekday(week[0]?.date ?? today))
      .map((row) => (
        <span aria-hidden="true" className="block size-3" key={row.name} />
      ))}
    {week.map((cell) => (
      <div
        aria-hidden="true"
        className={[
          cell.kind === 'future-padding' ? 'size-3' : cellClass[cell.level],
          cell.date === activeDate
            ? 'outline outline-1 outline-ink outline-offset-1'
            : '',
        ].join(' ')}
        data-activity-date={cell.kind === 'day' ? cell.date : undefined}
        key={cell.date}
        onPointerDown={
          cell.kind === 'day' ? () => setActiveDate(cell.date) : undefined
        }
        onPointerEnter={
          cell.kind === 'day' ? () => setActiveDate(cell.date) : undefined
        }
        ref={registerCell(cell.date)}
        title={cell.kind === 'day' ? activityDayDetails(cell) : undefined}
      />
    ))}
  </div>
);

export const ActivityMap = ({ cells, today }: ActivityMapProps) => {
  const descriptionId = useId();
  const detailsId = useId();
  const instructionsId = useId();
  const navigate = useNavigate();
  const weeks = activityWeeks(cells);
  const labels = monthColumnLabels(weeks);
  const days = cells.filter(
    (cell): cell is ActivityDayCell => cell.kind === 'day',
  );
  const { activeDay, moveActiveDay, registerCell, setActiveDate } =
    useActivitySelection(days);
  const openDay = (date: JournalDate): void => {
    const destination = date === today ? '/' : `/day/${date}`;
    const moved =
      date === today
        ? navigate({ to: '/' })
        : navigate({ params: { date }, to: '/day/$date' });
    moved.catch(() => globalThis.location.assign(destination));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Enter' && activeDay !== undefined) {
      event.preventDefault();
      openDay(activeDay.date);
      return;
    }
    moveActiveDay(event);
  };
  const handleClick = (event: MouseEvent<HTMLElement>): void => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const target = event.target.closest<HTMLElement>('[data-activity-date]');
    const date = target?.dataset.activityDate as JournalDate | undefined;
    if (date === undefined || !days.some((day) => day.date === date)) {
      return;
    }
    setActiveDate(date);
    openDay(date);
  };

  return (
    <figure className="m-0">
      {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: the one focusable scrolling region represents the whole chart; arrow keys and Enter provide its complete keyboard interaction without creating hundreds of tab stops. */}
      <section
        aria-describedby={`${descriptionId} ${instructionsId} ${detailsId}`}
        aria-label="Journal activity grid"
        className={['overflow-x-auto pb-1', focusRingClass].join(' ')}
        onClick={handleClick}
        onFocus={() => {
          const lastDay = days.at(-1);
          if (lastDay !== undefined) {
            setActiveDate(lastDay.date);
          }
        }}
        onKeyDown={handleKeyDown}
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
            aria-label={activitySummary(cells)}
            className="flex gap-0.5"
            role="img"
          >
            {weeks.map((week, index) => (
              <ActivityWeek
                activeDate={activeDay?.date}
                key={week[0]?.date ?? index}
                label={labels[index] ?? ''}
                registerCell={registerCell}
                setActiveDate={setActiveDate}
                today={today}
                week={week}
              />
            ))}
          </div>
        </div>
      </section>
      <p hidden={true} id={descriptionId}>
        {activityDescription(cells)}
      </p>
      <p hidden={true} id={instructionsId}>
        Use the arrow keys to inspect days. Press Enter to open the selected
        day.
      </p>
      <p
        aria-live="polite"
        className="mt-4 min-h-5 text-ink-muted text-sm"
        id={detailsId}
      >
        {activeDay === undefined
          ? 'This range has not started.'
          : activityDayDetails(activeDay)}
      </p>
      <figcaption
        className={[
          eyebrowClass,
          'mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-ink-faint',
        ].join(' ')}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={cellClass.none} />
          No writing
        </span>
        <span className="flex items-center gap-1">
          <span className="mr-1">Less</span>
          {legendSteps.map((step) => (
            <span aria-hidden="true" className={cellClass[step]} key={step} />
          ))}
          <span className="ml-1">More</span>
        </span>
      </figcaption>
      <ActivityTable cells={cells} today={today} />
    </figure>
  );
};
