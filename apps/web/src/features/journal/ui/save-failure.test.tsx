import { expect, it } from 'bun:test';
import { renderToString } from 'react-dom/server';

import {
  attributeValue,
  elementAttributes,
  openingTag,
} from '#/shared/testing/rendered-html.ts';
import { invalidScriptureReferenceMessage } from '../errors/journal-errors.ts';
import { SaveStatusLine } from './save-status.tsx';
import { ScriptureRegister } from './scripture-register.tsx';

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

it('associates a visible validation error with the passage field', () => {
  const html = renderToString(
    <ScriptureRegister
      initialMarkdown=""
      onLeave={doNothing}
      onMarkdownChange={doNothing}
      onReferenceChange={doNothing}
      reference="not a passage"
      referenceError={invalidScriptureReferenceMessage}
    />,
  );
  const input = openingTag(html, 'input');
  const errorId = attributeValue(input, 'aria-describedby');

  expect(input).toContain('aria-invalid="true"');
  expect(errorId).toBeDefined();
  expect(html).toContain(`id="${errorId}"`);
  expect(html).toContain(invalidScriptureReferenceMessage);
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

it('sends an authentication failure to sign-in instead of retrying', () => {
  const html = renderToString(
    <SaveStatusLine
      failure={{
        kind: 'authentication',
        message: 'Your session ended. Sign in again to save this entry.',
      }}
      onRetry={doNothing}
      status="failed"
    />,
  );

  expect(
    attributeValue(elementAttributes(html, 'a', 'Sign in again'), 'href'),
  ).toBe('/login');
  expect(html).not.toContain('Try again');
});
