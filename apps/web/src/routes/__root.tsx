import frauncesCss from '@fontsource-variable/fraunces/standard.css?url';
import frauncesItalicCss from '@fontsource-variable/fraunces/standard-italic.css?url';
import interCss from '@fontsource-variable/inter/index.css?url';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router';
import { viewportContent } from '../shared/ui/viewport.ts';
import appCss from '../styles.css?url';

/*
 * The two faces the theme names, loaded for the whole app rather than per page:
 * Fraunces for display, Inter for everything set as text. Fraunces ships its
 * italic as a separate file, and journal prose is markdown, so emphasis has to
 * have a real cut to resolve to rather than a slanted upright.
 */
const faces = [interCss, frauncesCss, frauncesItalicCss];

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
    links: [
      ...faces.map((href) => ({ rel: 'stylesheet', href })),
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});
