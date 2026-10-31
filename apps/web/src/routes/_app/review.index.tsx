import { createFileRoute, redirect } from '@tanstack/react-router';

/** The review opens on the current week, which has its own address. */
export const Route = createFileRoute('/_app/review/')({
  beforeLoad: () => {
    throw redirect({ to: '/review/week' });
  },
});
