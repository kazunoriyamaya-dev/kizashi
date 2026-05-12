import { z } from 'zod';
import {
  CategorySchema,
  InstructorAddressSchema,
  TransportationModeSchema,
} from '@/lib/validators/instructor';

/**
 * 講師自身が更新できる範囲
 *
 * 編集不可（admin のみ）:
 *  - real_name / real_name_kana （Q018: 本名は admin 管理）
 *  - rank （Q023: 指名料に紐づくため admin 設定）
 *  - status / priority / contact_email
 */
export const InstructorSelfUpdateSchema = z.object({
  nickname: z.string().min(1).max(30),
  avatar_url: z.string().url().optional().nullable(),
  public_bio: z.string().max(2000).optional().nullable(),
  contact_phone: z.string().max(20).optional().nullable(),
  categories: z.array(CategorySchema).min(1, 'カテゴリは1つ以上選択してください'),
  genres: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  transportation_mode: TransportationModeSchema,
  base_address: InstructorAddressSchema,
});
export type InstructorSelfUpdateInput = z.infer<typeof InstructorSelfUpdateSchema>;

export const InvoiceSettingsSchema = z.object({
  invoice_registration_no: z
    .string()
    .regex(/^T\d{13}$/, 'インボイス番号は T+13桁の数字です')
    .nullable()
    .optional(),
  registered_at: z.string().date().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type InvoiceSettingsInput = z.infer<typeof InvoiceSettingsSchema>;
