/** The durable browser-to-server contract for choosing an export shape. */

import { Schema } from 'effect';

import { type ExportGrouping, exportGroupings } from '../export-period.ts';

const ExportInputSchema = Schema.Struct({
  grouping: Schema.optional(Schema.Literal(...exportGroupings)),
});

const decodeInput = Schema.decodeUnknownSync(ExportInputSchema);

export type ExportInput = {
  readonly grouping: ExportGrouping;
};

/** Older deployed clients omitted the field, when Day was the only shape. */
export const decodeExportInput = (input: unknown): ExportInput => {
  const decoded = decodeInput(input ?? {});
  return { grouping: decoded.grouping ?? 'day' };
};

/** Decode the deployed native-form boundary, including older field-less POSTs. */
export const decodeExportFormData = (formData: FormData): ExportInput =>
  decodeExportInput({ grouping: formData.get('grouping') ?? undefined });
