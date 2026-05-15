import { describe, it, expect } from 'vitest';
import { CreateNormalReservationSchema } from '@/lib/validators/reservation';
import { TicketSchema } from '@/lib/validators/ticket';
import { ChildSchema } from '@/lib/validators/customer';
import {
  InstructorSelfUpdateSchema,
  InvoiceSettingsSchema,
} from '@/lib/validators/instructor-self';

const UUID = '12345678-1234-1234-1234-123456789012';

describe('CreateNormalReservationSchema', () => {
  it('valid input → success', () => {
    const r = CreateNormalReservationSchema.safeParse({
      instructor_id: UUID,
      child_id: UUID,
      customer_ticket_id: UUID,
      category: 'learning',
      start_at: '2026-06-01T10:00:00Z',
      end_at: '2026-06-01T11:00:00Z',
      duration_min: 60,
      delivery_type: 'online',
      pair_participants: [],
    });
    expect(r.success).toBe(true);
  });

  it('対面で住所なし → エラー', () => {
    const r = CreateNormalReservationSchema.safeParse({
      instructor_id: UUID,
      child_id: UUID,
      customer_ticket_id: UUID,
      category: 'sports',
      start_at: '2026-06-01T10:00:00Z',
      end_at: '2026-06-01T11:00:00Z',
      duration_min: 60,
      delivery_type: 'onsite',
    });
    expect(r.success).toBe(false);
  });

  it('end_at <= start_at → エラー', () => {
    const r = CreateNormalReservationSchema.safeParse({
      instructor_id: UUID,
      child_id: UUID,
      customer_ticket_id: UUID,
      category: 'art',
      start_at: '2026-06-01T11:00:00Z',
      end_at: '2026-06-01T10:00:00Z',
      duration_min: 60,
      delivery_type: 'online',
    });
    expect(r.success).toBe(false);
  });

  it('duration_min が 30/45/60/90/120 以外 → エラー', () => {
    const r = CreateNormalReservationSchema.safeParse({
      instructor_id: UUID,
      child_id: UUID,
      customer_ticket_id: UUID,
      category: 'learning',
      start_at: '2026-06-01T10:00:00Z',
      end_at: '2026-06-01T11:00:00Z',
      duration_min: 75,
      delivery_type: 'online',
    });
    expect(r.success).toBe(false);
  });
});

describe('TicketSchema', () => {
  it('valid input → success', () => {
    const r = TicketSchema.safeParse({
      name: '60分券',
      price: 4000,
      session_count: 1,
      valid_days: 90,
      duration_min: 60,
      lesson_format: 'solo',
      sort_order: 10,
      status: 'active',
    });
    expect(r.success).toBe(true);
  });

  it('価格が負 → エラー', () => {
    const r = TicketSchema.safeParse({
      name: 'NG',
      price: -1,
      session_count: 1,
      valid_days: 90,
      duration_min: 60,
    });
    expect(r.success).toBe(false);
  });
});

describe('ChildSchema (Q019)', () => {
  it('valid input → success', () => {
    const r = ChildSchema.safeParse({
      name: '山田太郎',
      kana: 'ヤマダタロウ',
      birth_date: '2015-04-01',
    });
    expect(r.success).toBe(true);
  });
  it('生年月日が YYYY-MM-DD でない → エラー', () => {
    const r = ChildSchema.safeParse({
      name: '山田',
      kana: 'ヤマダ',
      birth_date: '2015/4/1',
    });
    expect(r.success).toBe(false);
  });
});

describe('InstructorSelfUpdateSchema', () => {
  it('カテゴリが空 → エラー', () => {
    const r = InstructorSelfUpdateSchema.safeParse({
      nickname: '太郎',
      categories: [],
      transportation_mode: 'train',
      base_address: { address_line: '東京都新宿区' },
    });
    expect(r.success).toBe(false);
  });
});

describe('InvoiceSettingsSchema (Q012)', () => {
  it('T+13桁 → success', () => {
    const r = InvoiceSettingsSchema.safeParse({
      invoice_registration_no: 'T1234567890123',
    });
    expect(r.success).toBe(true);
  });
  it('T+12桁 → エラー', () => {
    const r = InvoiceSettingsSchema.safeParse({
      invoice_registration_no: 'T123456789012',
    });
    expect(r.success).toBe(false);
  });
  it('null は許可', () => {
    const r = InvoiceSettingsSchema.safeParse({ invoice_registration_no: null });
    expect(r.success).toBe(true);
  });
});
