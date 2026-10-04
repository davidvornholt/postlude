import { expect, it } from 'bun:test';
import { renderToString } from 'react-dom/server';

import { elementAttributes } from '#/shared/testing/rendered-html.ts';
import { SaveStatusLine } from './save-status.tsx';

const doNothing = () => undefined;

it('keeps normal autosave states behind one stable visible label', () => {
  const saved = renderToString(
    <SaveStatusLine failure={undefined} onRetry={doNothing} status="saved" />,
  );
  const saving = renderToString(
    <SaveStatusLine failure={undefined} onRetry={doNothing} status="saving" />,
  );

  expect(saved).toContain('Autosave on');
  expect(saved).toContain('All changes saved');
  expect(saving).toContain('Autosave on');
  expect(saving).toContain('Saving changes');
  expect(saved).not.toContain('aria-live');
  expect(saving).not.toContain('aria-live');
});

it('offers retry for a network failure without exposing its cause', () => {
  const html = renderToString(
    <SaveStatusLine
      failure={{
        kind: 'network',
        message: 'Saving failed. Check your connection and try again.',
      }}
      onRetry={doNothing}
      status="failed"
    />,
  );

  expect(html).toContain('aria-live="polite"');
  expect(elementAttributes(html, 'button', 'Try again')).toContain(
    'type="button"',
  );
  expect(html).not.toContain('Sign in again');
});
