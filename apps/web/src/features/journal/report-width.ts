/**
 * Whether the day report is shown in the text column or wide, remembered per
 * browser.
 *
 * The choice belongs to a screen, not to a day: a wide monitor suits the wide
 * report, a laptop may not. So it lives in the browser's `localStorage`, holds
 * nothing but the choice, and starts in the column wherever nothing has been
 * chosen yet. A browser that refuses storage still widens and narrows the
 * report; it only forgets the choice.
 */

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type ReportWidth = 'column' | 'wide';

export type ReportWidthMemory = {
  readonly read: () => ReportWidth;
  readonly remember: (width: ReportWidth) => void;
};

export const reportWidthKey = 'postlude:day-report-width:v1';

export const createReportWidthMemory = (
  storage: KeyValueStorage,
): ReportWidthMemory => ({
  read: () => {
    try {
      return storage.getItem(reportWidthKey) === 'wide' ? 'wide' : 'column';
    } catch {
      return 'column';
    }
  },
  remember: (width) => {
    try {
      storage.setItem(reportWidthKey, width);
    } catch {
      // The browser denies or has filled its storage. The report keeps the
      // width it was given until the page is left.
    }
  },
});

const forgetful: ReportWidthMemory = {
  read: () => 'column',
  remember: () => undefined,
};

/** The browser's memory, or one that forgets, on the server and where storage is refused. */
export const browserReportWidthMemory = (): ReportWidthMemory => {
  try {
    return createReportWidthMemory(globalThis.window.localStorage);
  } catch {
    return forgetful;
  }
};
