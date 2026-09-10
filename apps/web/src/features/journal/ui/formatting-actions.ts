import type { ChainedCommands } from '@tiptap/core';

export const formattingActions = [
  {
    label: 'Bold',
    mark: 'bold',
    hint: '⌘/Ctrl B',
    run: (chain: ChainedCommands) => chain.toggleBold().run(),
  },
  {
    label: 'Italic',
    mark: 'italic',
    hint: '⌘/Ctrl I',
    run: (chain: ChainedCommands) => chain.toggleItalic().run(),
  },
  {
    label: 'Heading',
    mark: 'heading',
    hint: '⌘/Ctrl Alt 1',
    run: (chain: ChainedCommands) => chain.toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Bullet list',
    mark: 'bulletList',
    hint: '⌘/Ctrl Shift 8',
    run: (chain: ChainedCommands) => chain.toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    mark: 'orderedList',
    hint: '⌘/Ctrl Shift 7',
    run: (chain: ChainedCommands) => chain.toggleOrderedList().run(),
  },
  {
    label: 'Quote',
    mark: 'blockquote',
    hint: '⌘/Ctrl Shift B',
    run: (chain: ChainedCommands) => chain.toggleBlockquote().run(),
  },
] as const;
