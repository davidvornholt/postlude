import type { ChangeEvent, RefObject, SubmitEvent } from 'react';
import { Button } from '#/shared/ui/action.tsx';
import {
  eyebrowClass,
  readingMeasureClass,
} from '#/shared/ui/design-classes.ts';
import { TextField } from '#/shared/ui/text-field.tsx';
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
    className={[readingMeasureClass, 'mt-8'].join(' ')}
    id={formId}
    method="post"
    onSubmit={onSubmit}
  >
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      {/* The field reserves the four pixels its focus outline occupies. Its
          visible focus edge and the button therefore finish on one baseline. */}
      <div className="min-w-64 flex-1 pb-1">
        <label
          className={[eyebrowClass, 'block text-ink-muted'].join(' ')}
          htmlFor={fieldId}
        >
          Words to find
        </label>
        <TextField
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid ? true : undefined}
          autoComplete="off"
          className="mt-3 text-lg"
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
      </div>
      <Button
        aria-disabled={pending}
        variant="primary"
        className="disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Searching' : 'Search'}
      </Button>
    </div>
    {invalid ? (
      <p className="mt-3 text-critical" id={errorId}>
        {invalidQueryMessage}
      </p>
    ) : null}
  </form>
);
