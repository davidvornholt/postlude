import { createLink } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import { ActionAnchor } from './action.tsx';

export const ActionLink = createLink(ActionAnchor);

// An action pointing at the current URL is not a current-page navigation item.
export const UnmarkedActionLink = createLink(
  ({
    'aria-current': _ariaCurrent,
    'data-status': _dataStatus,
    ...props
  }: ComponentProps<typeof ActionAnchor> & {
    readonly 'data-status'?: string;
  }) => <ActionAnchor {...props} />,
);
