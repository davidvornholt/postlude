import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

type ListItemAt = {
  readonly node: ProseMirrorNode;
  readonly pos: number;
};

const listItemTypes = new Set(['listItem', 'taskItem']);

const itemsOf = (list: ProseMirrorNode): Array<ListItemAt> => {
  const items: Array<ListItemAt> = [];
  list.descendants((node, pos) => {
    if (listItemTypes.has(node.type.name)) {
      items.push({ node, pos });
    }
  });
  return items;
};

type Conversion = {
  readonly after: ProseMirrorNode;
  readonly before: ProseMirrorNode;
  readonly from: number;
};

const conversionAt = (
  tr: Transaction,
  index: number,
  taskListName: string,
): Conversion | undefined => {
  const step = tr.steps[index];
  if (!(step instanceof ReplaceStep) || step.slice.content.childCount !== 1) {
    return;
  }
  const before = tr.docs[index]?.nodeAt(step.from);
  const after = step.slice.content.firstChild;
  return before &&
    after?.type.name === taskListName &&
    before.type.name !== taskListName &&
    before.nodeSize === step.to - step.from
    ? { after, before, from: step.from }
    : undefined;
};

/**
 * Turning a list into a checklist also converts the lists nested in it, and
 * Tiptap rebuilds a nested checklist item without its attributes, so a ticked
 * item would come back open. This ticks again each item that was ticked in
 * the list a step replaced with a checklist.
 */
export const retickConvertedItems = (
  tr: Transaction,
  taskListName: string,
): void => {
  for (const index of tr.steps.keys()) {
    const conversion = conversionAt(tr, index, taskListName);
    const before = conversion ? itemsOf(conversion.before) : [];
    const after = conversion ? itemsOf(conversion.after) : [];
    const later = tr.mapping.slice(index + 1);
    for (const [position, { node }] of before.entries()) {
      const converted = after[position];
      if (
        conversion &&
        before.length === after.length &&
        converted !== undefined &&
        node.attrs.checked === true
      ) {
        tr.setNodeMarkup(
          later.map(conversion.from + 1 + converted.pos),
          undefined,
          { ...converted.node.attrs, checked: true },
        );
      }
    }
  }
};
