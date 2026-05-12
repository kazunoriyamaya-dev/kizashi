/**
 * キャンセル/変更ポリシー判定 (Q013/Q014)
 *
 * 設計書 + QA:
 *  - 生徒都合: 開始 free_cancel_minutes_before_start 分前まで無料、
 *              それ以降はチケット消化扱い (もしくは half_refund_fee)
 *  - 弊社都合 / 講師都合: 期限関係なくチケット消化なし (Q014)
 *  - ticket_return_rule_in_deadline / _out_deadline / _company / _instructor を参照
 *
 * 結果フィールド:
 *  - canFreeCancel: 無料キャンセル可能 (期限内 or 弊社/講師都合)
 *  - canFreeChange:  無料変更可能
 *  - ticketReturnRule: 'full_return' | 'half_refund_fee' | 'no_return'
 *  - refundAmount: half_refund_fee の場合の概算返金額（円、税込）
 *  - reason: 'customer' | 'company' | 'instructor'
 */
import type { CancelReason } from '@/types';

export interface CancelPolicySnapshot {
  free_cancel_minutes_before_start: number;
  free_change_minutes_before_start: number;
  ticket_return_rule_in_deadline: string;
  ticket_return_rule_out_deadline: string;
  ticket_return_rule_company: string;
  ticket_return_rule_instructor: string;
}

export interface ReservationPolicyInput {
  startAt: string; // ISO
  reason: CancelReason; // customer | company | instructor
  policy: CancelPolicySnapshot;
  /** 半額返金時の元金額（チケット単価。指名料は別途扱い） */
  ticketUnitPrice?: number;
  /** 返金手数料（Q013 半額返金時に控除）。固定値、円単位 */
  refundFeeFlat?: number;
}

export interface ReservationPolicyResult {
  /** その操作（キャンセル）が許可されるか */
  allowed: boolean;
  /** 無料キャンセルとして処理されるか */
  isFree: boolean;
  /** 適用される ticket_return_rule_* の値 */
  ticketReturnRule: 'full_return' | 'half_refund_fee' | 'no_return';
  /** 開始時刻まで残り分数 (キャンセル時刻基準) */
  minutesUntilStart: number;
  /** 返金額（円、税込）。half_refund_fee 以外は0 */
  refundAmount: number;
  /** 返金手数料控除額 */
  refundFee: number;
  /** 顧客に表示するメッセージ */
  description: string;
}

/**
 * キャンセル時のポリシー適用結果を返す
 */
export function evaluateCancelPolicy(input: ReservationPolicyInput): ReservationPolicyResult {
  const minutesUntilStart = Math.floor(
    (new Date(input.startAt).getTime() - Date.now()) / 1000 / 60,
  );

  // 弊社都合 / 講師都合は時間関係なく全額返却 (Q014)
  if (input.reason === 'company') {
    const rule = (input.policy.ticket_return_rule_company || 'full_return') as
      | 'full_return'
      | 'half_refund_fee'
      | 'no_return';
    return {
      allowed: true,
      isFree: true,
      ticketReturnRule: rule,
      minutesUntilStart,
      refundAmount: 0,
      refundFee: 0,
      description: '弊社都合のため、チケットは全額返却されます',
    };
  }
  if (input.reason === 'instructor') {
    const rule = (input.policy.ticket_return_rule_instructor || 'full_return') as
      | 'full_return'
      | 'half_refund_fee'
      | 'no_return';
    return {
      allowed: true,
      isFree: true,
      ticketReturnRule: rule,
      minutesUntilStart,
      refundAmount: 0,
      refundFee: 0,
      description: '講師都合のため、チケットは消化されません (Q014)',
    };
  }

  // 顧客都合: 期限内/期限外で分岐
  const deadlineMin = input.policy.free_cancel_minutes_before_start;
  const inDeadline = minutesUntilStart >= deadlineMin;

  if (inDeadline) {
    return {
      allowed: true,
      isFree: true,
      ticketReturnRule: (input.policy.ticket_return_rule_in_deadline || 'full_return') as
        | 'full_return'
        | 'half_refund_fee'
        | 'no_return',
      minutesUntilStart,
      refundAmount: 0,
      refundFee: 0,
      description: `開始 ${deadlineMin} 分前のため無料キャンセル可能です`,
    };
  }

  // 期限外
  const rule = (input.policy.ticket_return_rule_out_deadline || 'no_return') as
    | 'full_return'
    | 'half_refund_fee'
    | 'no_return';
  const refundFee = input.refundFeeFlat ?? 0;
  let refundAmount = 0;
  let description = '';

  if (rule === 'half_refund_fee') {
    const unit = input.ticketUnitPrice ?? 0;
    refundAmount = Math.max(0, Math.floor(unit / 2) - refundFee);
    description = `Q013: 期限を過ぎたキャンセルです。チケット単価の半額 ¥${Math.floor(unit / 2)} から返金手数料 ¥${refundFee} を控除した ¥${refundAmount} を返金します`;
  } else if (rule === 'no_return') {
    description = '期限を過ぎたキャンセルのため、チケットは消化されます';
  } else if (rule === 'full_return') {
    description = '期限を過ぎていますが、ポリシー設定により全額返却されます';
  }

  return {
    allowed: minutesUntilStart >= 0, // 開始時刻を過ぎたら操作不可
    isFree: false,
    ticketReturnRule: rule,
    minutesUntilStart,
    refundAmount,
    refundFee,
    description,
  };
}

/**
 * 変更可否を判定
 *  - 変更は free_change_minutes_before_start を過ぎたら不可
 */
export function canChangeReservation(
  startAt: string,
  policy: CancelPolicySnapshot,
): { allowed: boolean; minutesUntilStart: number; deadlineMin: number } {
  const minutesUntilStart = Math.floor(
    (new Date(startAt).getTime() - Date.now()) / 1000 / 60,
  );
  return {
    allowed: minutesUntilStart >= policy.free_change_minutes_before_start,
    minutesUntilStart,
    deadlineMin: policy.free_change_minutes_before_start,
  };
}
