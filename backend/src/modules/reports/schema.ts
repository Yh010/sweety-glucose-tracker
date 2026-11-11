import { z } from 'zod';
import { readingSchema } from '../readings/schema.js';
const value = z.number().min(40).max(600).nullable();
export const cachedReportSchema = z
  .object({
    period: z.enum(['daily', 'mtd', 'monthly']),
    range: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    summary: z.object({
      count: z.number().int().min(0).max(124),
      highest: value,
      lowest: value,
      average: value,
    }),
    readings: z.array(readingSchema.extend({ id: z.string().uuid() })).max(124),
  })
  .refine((report) => report.summary.count === report.readings.length);
