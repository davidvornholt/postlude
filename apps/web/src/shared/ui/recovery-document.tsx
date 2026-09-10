import { useId } from 'react';
import { ActionAnchor } from './action.tsx';
import type { ApplicationStyleSheetHrefs } from './application-style-sheets.ts';
import { eyebrowClass, readingMeasureClass } from './design-classes.ts';
import { PageFrame } from './page-frame.tsx';

export type RecoveryDocumentProps = {
  readonly actionHref: string;
  readonly actionLabel: string;
  readonly heading: string;
  readonly message: string;
  readonly styleSheetHrefs: ApplicationStyleSheetHrefs;
  readonly title: string;
};

// Server rendering escapes content and shares the same controls as hydrated recovery pages.
export const RecoveryDocument = ({
  actionHref,
  actionLabel,
  heading,
  message,
  styleSheetHrefs,
  title,
}: RecoveryDocumentProps) => {
  const headingId = useId();
  return (
    <html lang="en">
      {/* biome-ignore lint/style/noHeadElement: This is a complete standalone HTTP recovery document, not a Next.js page. */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {styleSheetHrefs.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <main className="flex min-h-svh flex-col justify-center bg-background py-16">
          <PageFrame>
            <section aria-labelledby={headingId}>
              <p className={`${eyebrowClass} text-ink-faint`}>Postlude</p>
              <h1
                className="mt-5 font-display text-4xl text-ink sm:text-5xl"
                id={headingId}
              >
                {heading}
              </h1>
              <p
                className={`${readingMeasureClass} mt-8 border-border border-t pt-8 text-ink-muted text-lg`}
              >
                {message}
              </p>
              <p className="mt-10">
                <ActionAnchor autoFocus={true} href={actionHref}>
                  {actionLabel}
                </ActionAnchor>
              </p>
            </section>
          </PageFrame>
        </main>
      </body>
    </html>
  );
};
