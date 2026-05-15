import { z } from 'zod';
import { CategorySchema, DeliveryTypeSchema } from '@/lib/validators/reservation';

/**
 * 体験予約作成スキーマ (Q002/Q003/Q004)
 *
 * - child_id: 体験対象の子供 ID
 * - category: 希望ジャンル
 * - duration_min: 60 or 90
 * - delivery_type: online/onsite
 * - from_iso, to_iso: 希望時間範囲（自動割当はここから空き枠を探す）
 * - preferred_starts: 任意 - 候補時刻の絞り込み
 */
export const CreateTrialReservationSchema = z.object({
  child_id: z.string().uuid(),
  category: CategorySchema,
  duration_min: z.coerce
    .number()
    .int()
    .refine((v) => [30, 45, 60, 90, 120].includes(v)),
  delivery_type: DeliveryTypeSchema,
  from_iso: z.string().datetime(),
  to_iso: z.string().datetime(),
  preferred_starts: z.array(z.string().datetime()).max(20).optional().default([]),
});

export type CreateTrialReservationInput = z.infer<typeof CreateTrialReservationSchema>;
