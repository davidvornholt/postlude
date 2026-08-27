import { createFileRoute } from '@tanstack/react-router';

import { exportJournalResponse } from '#/features/journal/services/export-response.ts';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
// biome-ignore lint/correctness/noUnresolvedImports: Vite turns the canonical app stylesheet into its hashed production asset URL.
import appCss from '../../styles.css?url';

/** A native POST keeps the private archive out of URLs and browser memory. */
export const Route = createFileRoute('/_app/archive_/export')({
  server: {
    middleware: [sessionRequired],
    handlers: {
      POST: ({ request }) => exportJournalResponse(request.signal, appCss),
    },
  },
});
