import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/review/')({
  beforeLoad: () => {
    throw redirect({ to: '/review/week' });
  },
});
