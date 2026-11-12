/**
 * Records where elements are in each animation frame, in the page or in a
 * report inside it, to show what moves while something animates.
 */

export type Span = { readonly left: number; readonly right: number };
/** The edges of what `selector` finds, and the width of the window it is in, in one animation frame. */
export type Sample = {
  readonly spans: ReadonlyArray<Span>;
  readonly window: number;
};
/** What `startRecording` keeps on the window it records in. */
type Recorder = {
  postludeActed?: boolean;
  postludeSamples?: Promise<ReadonlyArray<Sample>>;
};

/**
 * Records the edges of what `selector` finds, and its window's width, in each
 * animation frame, until they have held still for a while after
 * `postludeActed` is set. It runs in the page or in the report, so it uses
 * nothing from outside itself.
 */
export const startRecording = (selector: string): void => {
  const recorder = globalThis as unknown as Recorder;
  const samples: Array<Sample> = [];
  let stillSince = performance.now();
  const sample = (): void => {
    const spans = [...document.querySelectorAll(selector)].map((element) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right };
    });
    const window = document.documentElement.getBoundingClientRect().width;
    const now = { spans, window };
    if (JSON.stringify(now) !== JSON.stringify(samples.at(-1))) {
      stillSince = performance.now();
    }
    samples.push(now);
  };
  const settled = (): boolean =>
    recorder.postludeActed === true && performance.now() - stillSince > 600;
  const record = async (): Promise<ReadonlyArray<Sample>> => {
    const end = performance.now() + 4000;
    while (performance.now() < end && !settled()) {
      sample();
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return samples;
  };
  recorder.postludeActed = false;
  recorder.postludeSamples = record();
};

/** Says the recording may end once things hold still, and returns it. */
export const stopRecording = (): Promise<ReadonlyArray<Sample>> => {
  const recorder = globalThis as unknown as Recorder;
  recorder.postludeActed = true;
  return recorder.postludeSamples ?? Promise.resolve([]);
};
