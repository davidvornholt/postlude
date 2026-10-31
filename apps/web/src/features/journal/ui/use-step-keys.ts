/**
 * The left and right arrow keys step to the date before and the date after,
 * as the two arrows under the heading do.
 *
 * Only the bare keys count, and only while focus is somewhere they mean
 * nothing else. In a field or the editor they move the caret, in a group of
 * choices they move the choice, and with a modifier they belong to the browser
 * or the system, such as Alt with an arrow going back. Arrow keys rather than
 * letters, because a letter on its own fires whenever speech input says a word
 * that has it.
 */

import { useEffect, useRef } from 'react';

type Steps = {
  readonly previous: (() => void) | undefined;
  readonly next: (() => void) | undefined;
};

/** Where an arrow key already does something. */
const ownsArrowKeys = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="combobox"]',
  '[role="grid"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="radiogroup"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="tablist"]',
  '[role="textbox"]',
  '[role="tree"]',
  'dialog',
].join(', ');

const stepFor = (key: string, steps: Steps): (() => void) | undefined => {
  if (key === 'ArrowLeft') {
    return steps.previous;
  }
  return key === 'ArrowRight' ? steps.next : undefined;
};

const keysAreTaken = (target: EventTarget | null): boolean =>
  (target instanceof Element && target.closest(ownsArrowKeys) !== null) ||
  document.querySelector('dialog[open]') !== null;

export const useStepKeys = (steps: Steps): void => {
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  });
  useEffect(() => {
    const press = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        keysAreTaken(event.target)
      ) {
        return;
      }
      const step = stepFor(event.key, stepsRef.current);
      if (step === undefined) {
        return;
      }
      event.preventDefault();
      step();
    };
    globalThis.addEventListener('keydown', press);
    return () => globalThis.removeEventListener('keydown', press);
  }, []);
};
