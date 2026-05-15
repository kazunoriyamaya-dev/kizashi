import { z } from 'zod';

export const TicketCategorySchema = z.enum(['learning', 'sports', 'art']);
export const LessonFormatSchema = z.enum(['solo', 'pair']);
export const TicketStatusSchema = z.enum(['active', 'inactive', 'deleted']);

export const TicketSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional().nullable(),
  category: TicketCategorySchema.nullable().optional(), // null = 共通
  price: z.coerce.number().int().min(0),
  session_count: z.coerce.number().int().min(1),
  valid_days: z.coerce.number().int().min(1).max(3650),
  duration_min: z.coerce
    .number()
    .int()
    .refine((v) => [30, 45, 60, 90, 120].includes(v), {
      message: 'duration_min は 30/45/60/90/120 のいずれか',
    }),
  lesson_format: LessonFormatSchema.default('solo'),
  sort_order: z.coerce.number().int().min(0).default(0),
  status: TicketStatusSchema.default('active'),
});
export type TicketInput = z.infer<typeof TicketSchema>;
