import { eyebrowClass } from '#/shared/ui/design-classes.ts';
import type { SearchResults as Results } from '../search-contract.ts';
import { SearchResults } from './search-results.tsx';

const one = 1;
const quietTextClass = 'mt-10 max-w-prose text-ink-muted text-lg';

const foundLabel = (results: Results): string => {
  const count = results.hits.length;
  const days = `${count} day${count === one ? '' : 's'}`;
  return results.limited
    ? `The first ${days} holding all of those words, newest first.`
    : `${days} hold${count === one ? 's' : ''} all of those words.`;
};

export const SearchAnswer = ({ results }: { readonly results: Results }) => {
  if (results.terms.length === 0) {
    return (
      <p className={quietTextClass}>
        {results.query === ''
          ? 'Every evening you have written is searchable. One word is usually enough; a word is matched from its beginning, so “rain” also finds “rainy”.'
          : 'That holds no words to search for. Try a word from the entry you are looking for.'}
      </p>
    );
  }
  if (results.hits.length === 0) {
    return (
      <p className={quietTextClass}>
        No day holds all of those words. Fewer words, or shorter ones, will find
        more.
      </p>
    );
  }
  return (
    <>
      <p className={[eyebrowClass, 'mt-12 text-ink-muted'].join(' ')}>
        {foundLabel(results)}
      </p>
      <div className="mt-6">
        <SearchResults hits={results.hits} today={results.today} />
      </div>
    </>
  );
};
