import type { MouseEvent } from 'react';
import { NavigationLink } from '#/shared/ui/navigation-link.tsx';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/calendar', label: 'Calendar', preload: false },
  { to: '/insights', label: 'Insights', preload: false },
  { to: '/search', label: 'Search' },
] as const;

type MainNavigationProps = {
  readonly insightsPending: boolean;
  readonly onOpenInsights: (
    event: MouseEvent<HTMLAnchorElement>,
  ) => Promise<void>;
  readonly onPrepareInsights: () => void;
};

type NavigationItemProps = MainNavigationProps & {
  readonly item: (typeof navItems)[number];
};

const NavigationItem = ({
  insightsPending,
  item,
  onOpenInsights,
  onPrepareInsights,
}: NavigationItemProps) => {
  const insights = item.to === '/insights';
  return (
    <li className={insights ? 'relative' : undefined}>
      <NavigationLink
        activeOptions={{ exact: item.to === '/' }}
        aria-busy={insights && insightsPending ? true : undefined}
        onClick={insights ? onOpenInsights : undefined}
        onFocus={insights ? onPrepareInsights : undefined}
        onPointerEnter={insights ? onPrepareInsights : undefined}
        preload={'preload' in item ? item.preload : undefined}
        to={item.to}
      >
        {item.label}
      </NavigationLink>
      {insights ? (
        <span
          aria-hidden="true"
          className={[
            'absolute top-0 left-full whitespace-nowrap',
            insightsPending ? 'visible' : 'invisible',
          ].join(' ')}
        >
          &nbsp;…
        </span>
      ) : null}
    </li>
  );
};

export const MainNavigation = ({
  insightsPending,
  onOpenInsights,
  onPrepareInsights,
}: MainNavigationProps) => (
  // The places wrap onto a second line on a phone rather than scroll sideways,
  // where the last of them would sit past the edge with nothing to say so.
  <nav aria-label="Main" className="max-w-full">
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-1">
      {navItems.map((item) => (
        <NavigationItem
          insightsPending={insightsPending}
          item={item}
          key={item.to}
          onOpenInsights={onOpenInsights}
          onPrepareInsights={onPrepareInsights}
        />
      ))}
    </ul>
  </nav>
);
