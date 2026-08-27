import type { ChangeEvent, RefObject, SubmitEvent } from 'react';

import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { fieldClass, primaryButtonClass } from '#/shared/ui/form-classes.ts';
import { searchQueryLengthLimit } from '../search-contract.ts';

const invalidQueryMessage = `Use ${searchQueryLengthLimit} characters or fewer. Your search was not sent.`;

type SearchFormProps = {
  readonly errorId: string;
  readonly fieldId: string;
  readonly fieldRef: RefObject<HTMLInputElement | null>;
  readonly formId: string;
  readonly invalid: boolean;
  readonly pending: boolean;
  readonly query: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export const SearchForm = ({
  errorId,
  fieldId,
  fieldRef,
  formId,
  invalid,
  pending,
  query,
  onChange,
  onSubmit,
}: SearchFormProps) => (
  <form
    action="/search"
    className={[
      readingMeasureClass,
      'mt-8 flex flex-wrap items-end gap-x-6 gap-y-4',
    ].join(' ')}
    id={formId}
    method="post"
    onSubmit={onSubmit}
  >
    <div className="min-w-64 flex-1">
      <label
        className={[eyebrowClass, 'block text-ink-muted'].join(' ')}
        htmlFor={fieldId}
      >
        Words to find
      </label>
      <input
        aria-describedby={invalid ? errorId : undefined}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        className={[fieldClass, 'mt-3 text-lg'].join(' ')}
        id={fieldId}
        maxLength={searchQueryLengthLimit}
        name="q"
        onChange={onChange}
        placeholder="A word you remember writing"
        readOnly={pending}
        ref={fieldRef}
        type="search"
        value={query}
      />
      {invalid ? (
        <p className="mt-3 text-critical" id={errorId}>
          {invalidQueryMessage}
        </p>
      ) : null}
    </div>
    <button
      aria-disabled={pending}
      className={[
        primaryButtonClass,
        'disabled:cursor-wait disabled:opacity-60',
      ].join(' ')}
      disabled={pending}
      type="submit"
    >
      {pending ? 'Searching' : 'Search'}
    </button>
  </form>
);
