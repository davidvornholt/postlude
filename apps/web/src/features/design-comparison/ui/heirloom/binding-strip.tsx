/**
 * The binding strip: the one loud thing in the heirloom theme.
 *
 * A page in this theme is a leaf out of a bound book, so the card carrying the
 * day is sewn at its left edge — a forest band, a brass hairline where the
 * board meets the paper, and the sewing stations themselves as stitch dots. A
 * dot is filled for each of the last seven days the streak covers, so the run
 * you are on is visible from the writing page without a number being printed
 * on it.
 *
 * The stations sit at the head of the spine at a fixed pitch rather than spread
 * over whatever height the day happens to be: seven of them have to be countable
 * at a glance, and a long entry would otherwise push them a screen apart.
 *
 * Dark mode is the one place the band needs its own instruction. `--pl-primary`
 * is light there because it is ink on dark grounds, so a band of it at full
 * strength would be the brightest thing on the page — the opposite of the deep
 * bound edge it is in light mode. Laid over the card at part strength it lands
 * between the card and the ink, which is where a bound edge belongs.
 *
 * It is a picture with a meaning, so it is labelled rather than hidden: the
 * label says in words what the filled dots say in fills.
 */

// Position names rather than indexes, so each stitch keeps its own identity.
const stitchStations = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
] as const;

const filledStitchClass = 'size-2 rounded-full bg-on-primary';
const emptyStitchClass = 'size-2 rounded-full border border-on-primary/45';

export const BindingStrip = ({
  streakDays,
}: {
  readonly streakDays: number;
}) => (
  <div
    aria-label={`Written ${streakDays} days in a row`}
    className="flex w-8 shrink-0 flex-col items-center gap-8 border-accent border-r bg-primary py-9 sm:w-10 dark:bg-primary/70"
    role="img"
  >
    {stitchStations.map((station, position) => (
      <span
        className={position < streakDays ? filledStitchClass : emptyStitchClass}
        key={station}
      />
    ))}
  </div>
);

/**
 * The archive's stat cards are bound too, but they are not the page: they get
 * the band as a thinner rule, with no stitching to compete with the number.
 */
export const BindingRule = () => (
  <span
    aria-hidden="true"
    className="w-1.5 shrink-0 bg-primary dark:bg-primary/70"
  />
);
