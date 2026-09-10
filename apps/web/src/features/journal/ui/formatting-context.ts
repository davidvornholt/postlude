import type { Editor } from '@tiptap/react';
import { createContext, useContext } from 'react';

export type ActiveEditor = {
  readonly editor: Editor;
  readonly label: string;
  readonly addImage: () => void;
};
export const FormattingContext = createContext<
  | {
      readonly active: ActiveEditor | undefined;
      readonly activate: (active: ActiveEditor) => void;
      readonly focusToolbar: () => void;
    }
  | undefined
>(undefined);
export const useFormattingToolbar = () => useContext(FormattingContext);
