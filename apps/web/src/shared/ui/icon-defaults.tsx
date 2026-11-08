import { LucideProvider } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * The size and stroke of every Lucide icon below it. The stroke is lighter
 * than Lucide's default of 2, which reads heavy beside the body text at 20px.
 */
export const IconDefaults = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <LucideProvider size={20} strokeWidth={1.7}>
    {children}
  </LucideProvider>
);
