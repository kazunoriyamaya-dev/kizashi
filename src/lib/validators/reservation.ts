import { z } from 'zod';

export const DeliveryTypeSchema = z.enum(['online', 'onsite']);
export const CategorySchema = z.enum(['learning', 'sports', 'art']);

/**
 * ペア参加者（Q001）
 * - type='child': 同じ保護者の他の子供を child_id で参照
 * - type='free_text': 外部参加者をフリーテキストで指定
 */
export const PairParticipantSchema = z.union([
  z.object({
    type: z.literal('child'),
    child_id: z.string().uuid(),
  }),
  z.object({
    type: z.literal('free_text'),
    name: z.string().min(1).max(60),
    note: z.string().max(200).optional().nullable(),
  }),
]);

/**
 * 通常予約 作成スキーマ
 *
 * - child_id: メインの受講者（NOT NULL）
 * - instructor_id: 通常予約は必須（体験予約は自動割当で NULL 可）
 * - customer_ticket_id: 消化対象。残数 0 ならフロントで Stripe 購入へ
 * - delivery_type='onsite' のとき location.address_line が必須
 * - pair_participants: ペアレッスン時のみ要素あり (Q001)
 */
export const CreateNormalReservationSchema = z
  .object({
    instructor_id: z.string().uuid(),
    child_id: z.string().uuid(),
    customer_ticket_id: z.string().uuid(),
    category: CategorySchema,
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    duration_min: z.coerce
      .number()
      .int()
      .refine((v) => [30, 45, 60, 90, 120].includes(v)),
    delivery_type: DeliveryTypeSchema,
    location: z
      .object({
        postal_code: z.string().max(10).optional().nullable(),
        prefecture: z.string().max(20).optional().nullable(),
        city: z.string().max(40).optional().nullable(),
        address_line: z.string().min(1).max(200),
        building: z.string().max(100).optional().nullable(),
      })
      .optional()
      .nullable(),
    pair_participants: z.array(PairParticipantSchema).max(3).optional().default([]),
  })
  .superRefine((val, ctx) => {
    if (val.delivery_type === 'onsite' && !val.location?.address_line) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['location', 'address_line'],
        message: '対面の場合は実施場所の住所が必須です',
      });
    }
    if (new Date(val.end_at) <= new Date(val.start_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end_at'],
        message: '終了時刻は開始時刻より後である必要があります',
      });
    }
  });

export type CreateNormalReservationInput = z.infer<typeof CreateNormalReservationSchema>;
export type PairParticipantInput = z.infer<typeof PairParticipantSchema>;
