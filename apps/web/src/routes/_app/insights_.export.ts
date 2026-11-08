import { createFileRoute } from '@tanstack/react-router';

import { exportJournalResponse } from '#/features/journal/services/export-response.ts';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { applicationStyleSheetHrefs } from '#/shared/ui/application-style-sheets.ts';

/** A native POST keeps the private export out of URLs and browser memory. */
export const Route = createFileRoute('/_app/insights_/export')({
  server: {
    middleware: [sessionRequired],
    handlers: {
      POST: ({ request }) =>
        exportJournalResponse(request, applicationStyleSheetHrefs),
    },
  },
});
