import { z } from 'zod';

/**
 * 講師の zod スキーマ（管理者向け CRUD）
 *
 * Q018: real_name, contact_email, contact_phone, base_address は非公開列
 * Q023: rank は gold/silver/bronze/regular
 */
export const InstructorRankSchema = z.enum(['gold', 'silver', 'bronze', 'regular']);
export const TransportationModeSchema = z.enum(['train', 'car']);
export const CategorySchema = z.enum(['learning', 'sports', 'art']);
export const ProfileStatusSchema = z.enum(['invited', 'active', 'suspended', 'deleted']);

export const InstructorAddressSchema = z.object({
  postal_code: z.string().min(1).max(10).optional().nullable(),
  prefecture: z.string().min(1).max(20).optional().nullable(),
  city: z.string().min(1).max(40).optional().nullable(),
  address_line: z.string().min(1).max(200),
  building: z.string().max(100).optional().nullable(),
});

export const CreateInstructorSchema = z.object({
  real_name: z.string().min(1).max(60),
  real_name_kana: z.string().min(1).max(60),
  nickname: z.string().min(1).max(30),
  contact_email: z.string().email(),
  contact_phone: z.string().max(20).optional().nullable(),
  public_bio: z.string().max(2000).optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  categories: z.array(CategorySchema).min(1, 'カテゴリは1つ以上選択してください'),
  genres: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  rank: InstructorRankSchema,
  transportation_mode: TransportationModeSchema,
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  base_address: InstructorAddressSchema,
});
export type CreateInstructorInput = z.infer<typeof CreateInstructorSchema>;

export const UpdateInstructorSchema = CreateInstructorSchema.partial().extend({
  status: ProfileStatusSchema.optional(),
});
export type UpdateInstructorInput = z.infer<typeof UpdateInstructorSchema>;
