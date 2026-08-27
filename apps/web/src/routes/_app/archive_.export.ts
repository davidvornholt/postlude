import { createFileRoute } from '@tanstack/react-router';

import { exportJournalResponse } from '#/features/journal/services/export-fns.ts';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';

/** A native POST keeps the private archive out of URLs and browser memory. */
export const Route = createFileRoute('/_app/archive_/export')({
  server: {
    middleware: [sessionRequired],
    handlers: {
      POST: ({ request }) => exportJournalResponse(request.signal),
    },
  },
});
