import { describe, it, expect } from 'vitest';
import {
  evaluateCancelPolicy,
  canChangeReservation,
  type CancelPolicySnapshot,
} from '@/lib/reservations/cancel-policy';

const policy: CancelPolicySnapshot = {
  free_cancel_minutes_before_start: 60,
  free_change_minutes_before_start: 60,
  ticket_return_rule_in_deadline: 'full_return',
  ticket_return_rule_out_deadline: 'half_refund_fee',
  ticket_return_rule_company: 'full_return',
  ticket_return_rule_instructor: 'full_return',
};

function inMinutes(min: number): string {
  return new Date(Date.now() + min * 60 * 1000).toISOString();
}

describe('Q013 キャンセルポリシー', () => {
  it('生徒都合・期限内 (60分以上前) → 無料・全額返却', () => {
    const r = evaluateCancelPolicy({
      startAt: inMinutes(120),
      reason: 'customer',
      policy,
      ticketUnitPrice: 4000,
    });
    expect(r.allowed).toBe(true);
    expect(r.isFree).toBe(true);
    expect(r.ticketReturnRule).toBe('full_return');
    expect(r.refundAmount).toBe(0);
  });

  it('生徒都合・期限外 (30分前) → half_refund_fee', () => {
    const r = evaluateCancelPolicy({
      startAt: inMinutes(30),
      reason: 'customer',
      policy,
      ticketUnitPrice: 4000,
      refundFeeFlat: 500,
    });
    expect(r.allowed).toBe(true);
    expect(r.isFree).toBe(false);
    expect(r.ticketReturnRule).toBe('half_refund_fee');
    // 4000 / 2 - 500 = 1500
    expect(r.refundAmount).toBe(1500);
  });

  it('講師都合 (Q014): 期限関係なくチケット消化なし', () => {
    const r = evaluateCancelPolicy({
      startAt: inMinutes(5),
      reason: 'instructor',
      policy,
      ticketUnitPrice: 4000,
    });
    expect(r.allowed).toBe(true);
    expect(r.isFree).toBe(true);
    expect(r.ticketReturnRule).toBe('full_return');
  });

  it('弊社都合: 期限関係なく全額返却', () => {
    const r = evaluateCancelPolicy({
      startAt: inMinutes(0),
      reason: 'company',
      policy,
      ticketUnitPrice: 4000,
    });
    expect(r.isFree).toBe(true);
    expect(r.ticketReturnRule).toBe('full_return');
  });

  it('開始時刻を過ぎたら allowed=false', () => {
    const r = evaluateCancelPolicy({
      startAt: inMinutes(-5),
      reason: 'customer',
      policy,
      ticketUnitPrice: 4000,
    });
    expect(r.allowed).toBe(false);
  });
});

describe('canChangeReservation', () => {
  it('60分以上前 → 変更可能', () => {
    const r = canChangeReservation(inMinutes(120), policy);
    expect(r.allowed).toBe(true);
  });
  it('30分前 → 変更不可', () => {
    const r = canChangeReservation(inMinutes(30), policy);
    expect(r.allowed).toBe(false);
  });
});
