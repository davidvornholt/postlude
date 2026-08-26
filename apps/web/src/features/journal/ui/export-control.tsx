/**
 * Taking the journal out of the app.
 *
 * The whole point of the control is that it hands over something that does not
 * need Postlude to be read, so what it says is what the writer gets — markdown
 * files, one to a day, in a zip — rather than "export", which says only that
 * something will happen.
 *
 * The server builds the archive and answers with it as bytes; this saves those
 * bytes under a name. A failure has to be visible, because a download that
 * silently does nothing is indistinguishable from a browser that saved the file
 * somewhere the writer has not looked yet.
 *
 * The call arrives as a prop, the way the writing page's save does. A page's
 * route owns which server function a page talks to, so the component stays a
 * component: it can be rendered in a test without the server runtime, and the
 * only thing it knows about the download is that it answers with a response.
 */

import { useMutation } from '@tanstack/react-query';
import type { RefObject } from 'react';
import { useRef } from 'react';

import { primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { exportFileName } from '../export-archive.ts';
import type { JournalDate } from '../journal-day.ts';

export type DownloadJournal = () => Promise<Response>;

/*
 * The object URL outlives the click by a moment on purpose: revoking it in the
 * same task as the click races the browser's own read of it, and the download
 * that loses that race fails with nothing to show for it.
 */
const releaseDelay = 1000;

const saveArchive = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), releaseDelay);
};

type ExportControlProps = {
  readonly today: JournalDate;
  readonly download: DownloadJournal;
};

export const ExportControl = ({ today, download }: ExportControlProps) => {
  // The same guard the sign-out control uses: mutation state lands in a later
  // render, so two activations inside one React batch would both read "not
  // pending" and build the archive twice.
  const started: RefObject<boolean> = useRef(false);
  const gathering = useMutation({
    mutationFn: async () => {
      const response = await download();
      saveArchive(await response.blob(), exportFileName(today));
    },
    onSettled: () => {
      started.current = false;
    },
  });
  const start = () => {
    if (started.current) {
      return;
    }
    started.current = true;
    gathering.mutate();
  };

  return (
    <div>
      <p className="max-w-prose text-ink-muted text-lg">
        Every day you have written, as markdown files in a zip — one file to a
        day, in a folder for each year. It opens in a text editor and in
        anything that reads markdown, with or without Postlude.
      </p>
      <button
        // Staying enabled keeps focus on the button while the archive is being
        // built; disabling it here would drop focus to the document and
        // announce the new label to nobody.
        aria-busy={gathering.isPending}
        className={[primaryButtonClass, 'mt-6'].join(' ')}
        onClick={start}
        type="button"
      >
        {gathering.isPending ? 'Gathering the days …' : 'Download the journal'}
      </button>
      {gathering.isError ? (
        <p
          className="mt-4 max-w-prose border border-critical bg-critical-subtle px-3 py-2 text-ink text-sm"
          role="alert"
        >
          The journal could not be gathered. Nothing has changed; check your
          connection and try again.
        </p>
      ) : null}
    </div>
  );
};
