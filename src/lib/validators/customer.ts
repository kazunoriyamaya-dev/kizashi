import { z } from 'zod';

/**
 * 顧客プロフィール（保護者単位 Q001）
 *
 * Q019: 子供情報は氏名/カナ/生年月日のみ
 * 学校名・写真は持たない
 */
export const CustomerProfileSchema = z.object({
  parent_name: z.string().min(1).max(60),
  parent_kana: z.string().max(60).optional().nullable(),
  display_name: z.string().min(1).max(40).optional(),
  phone: z.string().max(20).optional().nullable(),
  primary_address: z
    .object({
      postal_code: z.string().max(10).optional().nullable(),
      prefecture: z.string().max(20).optional().nullable(),
      city: z.string().max(40).optional().nullable(),
      address_line: z.string().min(1).max(200),
      building: z.string().max(100).optional().nullable(),
    })
    .optional(),
});
export type CustomerProfileInput = z.infer<typeof CustomerProfileSchema>;

export const ChildSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(40),
  kana: z.string().min(1, 'フリガナは必須です').max(40),
  birth_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '生年月日は YYYY-MM-DD 形式で入力してください'),
  notes: z.string().max(200).optional().nullable(),
});
export type ChildInput = z.infer<typeof ChildSchema>;
