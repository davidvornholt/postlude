import { createLink } from '@tanstack/react-router';

import { SegmentAnchor } from './segmented-control.tsx';

/** A segment of a `SegmentedTrack` that goes somewhere, with the router's preloading. */
export const SegmentLink = createLink(SegmentAnchor);
