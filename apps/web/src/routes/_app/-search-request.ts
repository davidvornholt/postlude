import { searchFailureKind } from '#/features/journal/errors/search-errors.ts';
import { searchQueryLengthLimit } from '#/features/journal/search-contract.ts';
import { searchResponseOf } from '#/features/journal/services/search-response.ts';
import type {
  SearchCall,
  SearchPageView,
} from '#/features/journal/ui/search-page.tsx';

export type SearchServerContext = {
  readonly searchView: SearchPageView;
};

type SearchPostInput<Result> = {
  readonly request: Request;
  readonly next: (options: { readonly context: SearchServerContext }) => Result;
};

const queryFrom = async (request: Request): Promise<string> => {
  const value = (await request.formData()).get('q');
  return typeof value === 'string' ? value : '';
};

const searchView = async (
  query: string,
  search: SearchCall,
): Promise<SearchPageView> => {
  if (query.length > searchQueryLengthLimit) {
    return { state: 'invalid', query };
  }
  try {
    const response = searchResponseOf(
      await search({
        data: query === '' ? {} : { q: query },
      }),
    );
    return response.state === 'answered'
      ? response
      : { state: response.state, query };
  } catch (error) {
    return {
      state:
        searchFailureKind(error) === 'authentication'
          ? 'authentication-required'
          : 'failed',
      query,
    };
  }
};

export const handleSearchPost = async <Result>(
  { next, request }: SearchPostInput<Result>,
  search: SearchCall,
): Promise<Result> =>
  next({
    context: { searchView: await searchView(await queryFrom(request), search) },
  });

export const loadSearchView = (
  serverContext: unknown,
  search: SearchCall,
): SearchPageView | Promise<SearchPageView> => {
  const context = serverContext as SearchServerContext | undefined;
  return context?.searchView ?? searchView('', search);
};
