import { createFileRoute } from '@tanstack/react-router';

import { uploadImageResponse } from '#/features/journal/services/image-response.ts';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';

export const Route = createFileRoute('/api/journal-images/')({
  server: {
    middleware: [sessionRequired],
    handlers: { POST: ({ request }) => uploadImageResponse(request) },
  },
});
