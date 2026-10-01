/**
 * The icon links for every Postlude document. Vite copies the files from
 * `public/` to the site root. The ICO declares one size so browsers that read
 * SVG icons prefer the SVG; it remains for the ones that do not.
 */
export const applicationIconLinks = [
  { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
] as const;
