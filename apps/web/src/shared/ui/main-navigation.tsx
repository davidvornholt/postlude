import type { MouseEvent } from 'react';
import { NavigationLink } from '#/shared/ui/navigation-link.tsx';

const navItems = [
  { to: '/', label: 'Today' },
  { to: '/calendar', label: 'Calendar', preload: false },
  { to: '/on-this-day', label: 'On this day', preload: false },
  { to: '/archive', label: 'Archive', preload: false },
  { to: '/search', label: 'Search' },
] as const;

type MainNavigationProps = {
  readonly archivePending: boolean;
  readonly onOpenArchive: (
    event: MouseEvent<HTMLAnchorElement>,
  ) => Promise<void>;
  readonly onPrepareArchive: () => void;
};

type NavigationItemProps = MainNavigationProps & {
  readonly item: (typeof navItems)[number];
};

const NavigationItem = ({
  archivePending,
  item,
  onOpenArchive,
  onPrepareArchive,
}: NavigationItemProps) => {
  const archive = item.to === '/archive';
  return (
    <li className={archive ? 'relative' : undefined}>
      <NavigationLink
        activeOptions={{ exact: item.to === '/' }}
        aria-busy={archive && archivePending ? true : undefined}
        onClick={archive ? onOpenArchive : undefined}
        onFocus={archive ? onPrepareArchive : undefined}
        onPointerEnter={archive ? onPrepareArchive : undefined}
        preload={'preload' in item ? item.preload : undefined}
        to={item.to}
      >
        {item.label}
      </NavigationLink>
      {archive ? (
        <span
          aria-hidden="true"
          className={[
            'absolute top-0 left-full whitespace-nowrap',
            archivePending ? 'visible' : 'invisible',
          ].join(' ')}
        >
          &nbsp;…
        </span>
      ) : null}
    </li>
  );
};

export const MainNavigation = ({
  archivePending,
  onOpenArchive,
  onPrepareArchive,
}: MainNavigationProps) => (
  <nav aria-label="Main" className="max-w-full overflow-x-auto">
    <ul className="flex w-max items-center gap-6 pb-1">
      {navItems.map((item) => (
        <NavigationItem
          archivePending={archivePending}
          item={item}
          key={item.to}
          onOpenArchive={onOpenArchive}
          onPrepareArchive={onPrepareArchive}
        />
      ))}
    </ul>
  </nav>
);
