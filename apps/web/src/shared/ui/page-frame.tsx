import type { ComponentProps } from 'react';

type PageFrameProps = ComponentProps<'div'> & {
  readonly as?: 'div' | 'header' | 'section';
};

// Full-width grounds stay outside the frame; each page shares the masthead's inset.
export const PageFrame = ({
  as: Tag = 'div',
  className = '',
  ...props
}: PageFrameProps) => (
  <Tag
    {...props}
    className={`mx-auto w-full max-w-4xl px-5 sm:px-8 ${className}`}
  />
);
