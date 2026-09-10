const paths = {
  bold: 'M7 4h6a4 4 0 0 1 0 8H7m0-8v16h7a4 4 0 0 0 0-8H7',
  italic: 'M10 4h9M5 20h9M15 4 9 20',
  heading: 'M5 4v16M19 4v16M5 12h14',
  bulletList: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  orderedList:
    'M10 6h10M10 12h10M10 18h10M3 4h1v5M3 9h3M3 14c0-2 3-2 3 0 0 1-3 2-3 4h3',
  blockquote: 'M10 5H4v7h6V5Zm0 7c0 4-2 6-5 7M20 5h-6v7h6V5Zm0 7c0 4-2 6-5 7',
  image:
    'M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h8M4 16l5-5 7 9M19 3v6M16 6h6M9 7h.01',
  close: 'm6 6 12 12M6 18 18 6',
} as const;

export type JournalIconName = keyof typeof paths;

export const JournalIcon = ({ name }: { readonly name: JournalIconName }) => (
  <svg
    aria-hidden="true"
    className="size-5"
    fill="none"
    focusable="false"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.7"
    viewBox="0 0 24 24"
  >
    <path d={paths[name]} />
  </svg>
);
