import { z } from 'zod';
import { dateSchema } from '../../lib/dates.js';

export const slots = ['fasting', 'after_breakfast', 'after_lunch', 'after_dinner'] as const;
export const slotLabels = {
  fasting: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};
export const readingSchema = z
  .object({
    date: dateSchema,
    slot: z.enum(slots, { error: 'Choose one of the four time slots.' }),
    value: z
      .number({ error: 'Please enter a glucose value.' })
      .int('Value must be a whole number between 40 and 600 mg/dl.')
      .min(40, 'Value must be between 40 and 600 mg/dl.')
      .max(600, 'Value must be between 40 and 600 mg/dl.'),
  })
  .strict();
export const updateSchema = readingSchema.extend({
  version: z.number().int().positive('Reload this reading before saving.'),
});
export const listSchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Start date must be on or before end date.');
export type ReadingInput = z.infer<typeof readingSchema>;
export type Reading = ReadingInput & { id: string; version: number };
