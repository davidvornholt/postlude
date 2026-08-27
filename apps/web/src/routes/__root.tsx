import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { applicationStyleSheetHrefs } from '../shared/ui/application-style-sheets.ts';
import { viewportContent } from '../shared/ui/viewport.ts';

type RouterContext = {
  readonly queryClient: QueryClient;
};

const RootDocument = ({ children }: { readonly children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      {children}
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: viewportContent },
      { title: 'Postlude' },
      {
        name: 'description',
        content:
          'Postlude — a calm journal for closing out the day: evening writing, morning scripture notes, and a quiet archive.',
      },
    ],
    links: applicationStyleSheetHrefs.map((href) => ({
      rel: 'stylesheet',
      href,
    })),
  }),
  shellComponent: RootDocument,
});
