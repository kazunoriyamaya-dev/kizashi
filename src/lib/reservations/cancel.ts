/**
 * 予約キャンセル (F033 / API019)
 *
 * フロー:
 *  1. 予約取得 + 権限検証（呼び出し側で別途）
 *  2. evaluateCancelPolicy で適用ルール決定
 *  3. fn_cancel_reservation RPC（ステータス更新 + チケット返却）
 *  4. half_refund_fee の場合は Stripe Refund API 呼び出し
 *  5. Google Calendar event を削除
 *  6. 通知ログ作成
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { deleteCalendarEvent } from '@/lib/google/calendar';
import { getStripe } from '@/lib/stripe';
import { evaluateCancelPolicy, type CancelPolicySnapshot } from '@/lib/reservations/cancel-policy';
import { logger } from '@/lib/logger';
import type { CancelReason, Role } from '@/types';

export interface CancelReservationInput {
  reservationId: string;
  actorProfileId: string;
  actorRole: Role;
  reason: CancelReason;
  note?: string | null;
  /** 半額返金時に Stripe Refund を実行するか */
  performStripeRefund?: boolean;
}

export type CancelErrorCode =
  | 'reservation_not_found'
  | 'reservation_already_finalized'
  | 'invalid_ticket_return_rule'
  | 'unknown';

export type CancelReservationResult =
  | {
      ok: true;
      reservationId: string;
      ticketReturned: boolean;
      refundAmount: number;
      stripeRefundId?: string;
      description: string;
    }
  | {
      ok: false;
      errorCode: CancelErrorCode;
      detail?: string;
    };

export async function cancelReservation(
  input: CancelReservationInput,
): Promise<CancelReservationResult> {
  const admin = createSupabaseAdminClient();

  // 予約 + ポリシー + 関連情報を取得
  const { data: rsv } = await admin
    .from('reservations')
    .select(
      `id, start_at, status, reservation_type, customer_id, customer_ticket_id, google_event_id, instructor_id,
       customer_tickets!reservations_customer_ticket_id_fkey (
         payment_id,
         tickets!customer_tickets_ticket_id_fkey ( price )
       )`,
    )
    .eq('id', input.reservationId)
    .maybeSingle();

  if (!rsv) return { ok: false, errorCode: 'reservation_not_found' };
  if (rsv.status === 'cancelled' || rsv.status === 'completed') {
    return { ok: false, errorCode: 'reservation_already_finalized' };
  }

  const { data: policyRow } = await admin
    .from('cancel_policies')
    .select(
      'free_cancel_minutes_before_start, free_change_minutes_before_start, ticket_return_rule_in_deadline, ticket_return_rule_out_deadline, ticket_return_rule_company, ticket_return_rule_instructor',
    )
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const policy: CancelPolicySnapshot = {
    free_cancel_minutes_before_start: policyRow?.free_cancel_minutes_before_start ?? 60,
    free_change_minutes_before_start: policyRow?.free_change_minutes_before_start ?? 60,
    ticket_return_rule_in_deadline: policyRow?.ticket_return_rule_in_deadline ?? 'full_return',
    ticket_return_rule_out_deadline: policyRow?.ticket_return_rule_out_deadline ?? 'no_return',
    ticket_return_rule_company: policyRow?.ticket_return_rule_company ?? 'full_return',
    ticket_return_rule_instructor: policyRow?.ticket_return_rule_instructor ?? 'full_return',
  };

  const ticketUnitPrice = rsv.customer_tickets?.tickets?.price ?? 0;

  const evaluation = evaluateCancelPolicy({
    startAt: rsv.start_at,
    reason: input.reason,
    policy,
    ticketUnitPrice,
    refundFeeFlat: 500, // 返金手数料 (Q013): 固定 500円 と仮置き
  });

  // RPC でキャンセル + チケット返却
  const { error: rpcErr } = await admin.rpc('fn_cancel_reservation', {
    p_reservation_id: input.reservationId,
    p_actor_profile_id: input.actorProfileId,
    p_actor_role: input.actorRole,
    p_cancel_reason: input.reason,
    p_ticket_return_rule: evaluation.ticketReturnRule,
    p_cancel_note: input.note ?? null,
  });

  if (rpcErr) {
    if (rpcErr.message === 'reservation_already_finalized') {
      return { ok: false, errorCode: 'reservation_already_finalized' };
    }
    logger.error('fn_cancel_reservation failed', { code: rpcErr.code, detail: rpcErr.message });
    return { ok: false, errorCode: 'unknown', detail: rpcErr.code };
  }

  // Stripe Refund (half_refund_fee のみ)
  let stripeRefundId: string | undefined;
  let actualRefund = evaluation.refundAmount;
  if (
    input.performStripeRefund !== false &&
    evaluation.ticketReturnRule === 'half_refund_fee' &&
    evaluation.refundAmount > 0
  ) {
    try {
      const paymentId = rsv.customer_tickets?.payment_id;
      if (paymentId) {
        const { data: payment } = await admin
          .from('payments')
          .select('stripe_payment_intent_id, stripe_charge_id')
          .eq('id', paymentId)
          .maybeSingle();
        if (payment?.stripe_payment_intent_id) {
          const stripe = getStripe();
          const refund = await stripe.refunds.create({
            payment_intent: payment.stripe_payment_intent_id,
            amount: evaluation.refundAmount,
            reason: 'requested_by_customer',
            metadata: {
              kizashi_reservation_id: input.reservationId,
            },
          });
          stripeRefundId = refund.id;
          // payments.refunded_amount を加算
          await admin
            .from('payments')
            .update({
              refunded_amount: evaluation.refundAmount,
              refunded_at: new Date().toISOString(),
              status: 'partially_refunded',
            })
            .eq('id', paymentId);
        }
      }
    } catch (e) {
      logger.error('stripe refund failed', { code: (e as Error).message });
      // Refund 失敗はキャンセル自体は成立済み。後で管理者対応に回す
      actualRefund = 0;
    }
  }

  // Google Calendar event を削除
  if (rsv.google_event_id && rsv.instructor_id) {
    try {
      await deleteCalendarEvent(rsv.instructor_id, rsv.google_event_id);
    } catch (e) {
      logger.warn('calendar delete failed (non-blocking)', { code: (e as Error).message });
    }
  }

  // 通知: 顧客に対して 3 チャネル
  const { data: cust } = await admin
    .from('customers')
    .select('profile_id')
    .eq('id', rsv.customer_id)
    .maybeSingle();

  if (cust?.profile_id) {
    const { enqueueNotification } = await import('@/lib/notifications/dispatch');
    const template =
      input.reason === 'customer'
        ? 'reservation_cancelled_by_customer'
        : input.reason === 'instructor'
          ? 'reservation_cancelled_by_instructor'
          : 'reservation_cancelled_by_company';
    await enqueueNotification(
      template,
      { profileId: cust.profile_id },
      {
        reservation_id: input.reservationId,
        reason: input.reason,
        ticket_return_rule: evaluation.ticketReturnRule,
        refund_amount: actualRefund,
      },
    );
  }

  return {
    ok: true,
    reservationId: input.reservationId,
    ticketReturned: evaluation.ticketReturnRule === 'full_return',
    refundAmount: actualRefund,
    stripeRefundId,
    description: evaluation.description,
  };
}
