import type { ChainedCommands } from '@tiptap/core';
import { Bold, Heading, Italic, List, ListOrdered, Quote } from 'lucide-react';

export const formattingActions = [
  {
    label: 'Bold',
    mark: 'bold',
    icon: Bold,
    hint: '⌘/Ctrl B',
    run: (chain: ChainedCommands) => chain.toggleBold().run(),
  },
  {
    label: 'Italic',
    mark: 'italic',
    icon: Italic,
    hint: '⌘/Ctrl I',
    run: (chain: ChainedCommands) => chain.toggleItalic().run(),
  },
  {
    label: 'Heading',
    mark: 'heading',
    icon: Heading,
    hint: '⌘/Ctrl Alt 1',
    run: (chain: ChainedCommands) => chain.toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Bullet list',
    mark: 'bulletList',
    icon: List,
    hint: '⌘/Ctrl Shift 8',
    run: (chain: ChainedCommands) => chain.toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    mark: 'orderedList',
    icon: ListOrdered,
    hint: '⌘/Ctrl Shift 7',
    run: (chain: ChainedCommands) => chain.toggleOrderedList().run(),
  },
  {
    label: 'Quote',
    mark: 'blockquote',
    icon: Quote,
    hint: '⌘/Ctrl Shift B',
    run: (chain: ChainedCommands) => chain.toggleBlockquote().run(),
  },
] as const;
