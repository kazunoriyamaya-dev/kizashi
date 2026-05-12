/**
 * アプリ共通型定義
 *
 * Database.Tables 由来の型は `@/types/database` から取得し、
 * ドメイン側で扱う型はここで再エクスポート / 派生定義する。
 */
export type { Role } from '@/lib/permissions';

export type Category = 'learning' | 'sports' | 'art';

export type InstructorRank = 'gold' | 'silver' | 'bronze' | 'regular';

export type LessonFormat = 'solo' | 'pair';

export type DeliveryType = 'online' | 'onsite';

export type ReservationStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'changed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type CustomerTicketStatus = 'active' | 'expired' | 'used' | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type ProfileStatus = 'invited' | 'active' | 'suspended' | 'deleted';

export type TransportationMode = 'train' | 'car';

export const INSTRUCTOR_DESIGNATION_FEES: Readonly<Record<InstructorRank, number>> = {
  gold: 1500,
  silver: 1000,
  bronze: 500,
  regular: 0,
} as const;

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  learning: '学習',
  sports: 'スポーツ',
  art: '芸術',
} as const;

export const RANK_LABELS: Readonly<Record<InstructorRank, string>> = {
  gold: 'ゴールド',
  silver: 'シルバー',
  bronze: 'ブロンズ',
  regular: 'レギュラー',
} as const;
