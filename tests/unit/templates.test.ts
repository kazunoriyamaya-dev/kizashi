import { describe, it, expect } from 'vitest';
import { renderTemplate } from '@/lib/notifications/templates';

describe('通知テンプレート', () => {
  it('reservation_confirmed: subject に「予約を確定」', () => {
    const r = renderTemplate('reservation_confirmed', { reservation_id: 'rsv-1' });
    expect(r.subject).toContain('予約を確定');
    expect(r.html).toContain('rsv-1');
    expect(r.pushTitle).toBeTruthy();
    expect(r.lineText).toContain('予約を確定');
  });

  it('reservation_cancelled_by_instructor: Q014 メッセージを含む', () => {
    const r = renderTemplate('reservation_cancelled_by_instructor', { reservation_id: 'rsv-1' });
    expect(r.text).toContain('講師都合');
  });

  it('reservation_cancelled_by_customer: full_return / no_return で文言切替', () => {
    const ret = renderTemplate('reservation_cancelled_by_customer', {
      reservation_id: 'rsv-1',
      ticket_return_rule: 'full_return',
    });
    expect(ret.text).toContain('チケット返却');

    const consumed = renderTemplate('reservation_cancelled_by_customer', {
      reservation_id: 'rsv-1',
      ticket_return_rule: 'no_return',
    });
    expect(consumed.text).toContain('チケット消化');
  });

  it('ticket_expiring: 日数を埋め込み', () => {
    const r = renderTemplate('ticket_expiring', { days_left: 7 });
    expect(r.subject).toContain('7');
    expect(r.pushTitle).toContain('7');
  });

  it('未定義テンプレートはデフォルト動作', () => {
    const r = renderTemplate('non_existent', { subject: 'カスタム件名', text: '本文' });
    expect(r.subject).toBe('カスタム件名');
    expect(r.text).toBe('本文');
  });
});
