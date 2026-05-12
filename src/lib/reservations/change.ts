/**
 * 予約変更 (F032 / API018)
 *
 * フロー:
 *  1. 予約取得 + 変更可否判定 (canChangeReservation)
 *  2. fn_change_reservation RPC（時間/形式/場所更新、EXCLUDE 制約再検証）
 *  3. 23P01 → time_conflict
 *  4. Google Calendar event を patch
 *  5. 通知ログ作成
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { updateCalendarEvent } from '@/lib/google/calendar';
import { canChangeReservation, type CancelPolicySnapshot } from '@/lib/reservations/cancel-policy';
import { logger } from '@/lib/logger';
import type { DeliveryType, Role } from '@/types';

export interface ChangeReservationInput {
  reservationId: string;
  actorProfileId: string;
  actorRole: Role;
  newStartIso: string;
  newEndIso: string;
  newDeliveryType?: DeliveryType;
  /** 対面の場合の新しい場所 (address_id) */
  newLocationAddressId?: string | null;
}

export type ChangeErrorCode =
  | 'reservation_not_found'
  | 'reservation_finalized'
  | 'change_deadline_passed'
  | 'time_conflict'
  | 'invalid_time_range'
  | 'unknown';

export type ChangeReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; errorCode: ChangeErrorCode; detail?: string };

export async function changeReservation(
  input: ChangeReservationInput,
): Promise<ChangeReservationResult> {
  const admin = createSupabaseAdminClient();

  const { data: rsv } = await admin
    .from('reservations')
    .select('id, start_at, status, google_event_id, instructor_id')
    .eq('id', input.reservationId)
    .maybeSingle();

  if (!rsv) return { ok: false, errorCode: 'reservation_not_found' };
  if (rsv.status === 'cancelled' || rsv.status === 'completed' || rsv.status === 'no_show') {
    return { ok: false, errorCode: 'reservation_finalized' };
  }

  // ポリシー判定（admin は無視できるが、ここでは admin 自身も検証する仕様）
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

  // 管理者は期限外でも変更可能とする
  if (input.actorRole !== 'admin') {
    const judge = canChangeReservation(rsv.start_at, policy);
    if (!judge.allowed) {
      return { ok: false, errorCode: 'change_deadline_passed' };
    }
  }

  const { error: rpcErr } = await admin.rpc('fn_change_reservation', {
    p_reservation_id: input.reservationId,
    p_actor_profile_id: input.actorProfileId,
    p_actor_role: input.actorRole,
    p_new_start_at: input.newStartIso,
    p_new_end_at: input.newEndIso,
    p_new_delivery_type: input.newDeliveryType ?? null,
    p_new_location_address_id: input.newLocationAddressId ?? null,
  });

  if (rpcErr) {
    if (rpcErr.code === '23P01') return { ok: false, errorCode: 'time_conflict' };
    if (rpcErr.message === 'invalid_time_range') {
      return { ok: false, errorCode: 'invalid_time_range' };
    }
    if (rpcErr.message === 'reservation_finalized') {
      return { ok: false, errorCode: 'reservation_finalized' };
    }
    logger.error('fn_change_reservation failed', { code: rpcErr.code, detail: rpcErr.message });
    return { ok: false, errorCode: 'unknown', detail: rpcErr.code };
  }

  // Google Calendar event を patch
  if (rsv.google_event_id && rsv.instructor_id) {
    try {
      await updateCalendarEvent(rsv.instructor_id, rsv.google_event_id, {
        startISO: input.newStartIso,
        endISO: input.newEndIso,
      });
    } catch (e) {
      logger.warn('calendar update failed (non-blocking)', { code: (e as Error).message });
    }
  }

  // 通知 (3 チャネル) — 顧客への通知が必要なので reservation の customer_id から profile_id を引く
  const { data: rsvData } = await admin
    .from('reservations')
    .select(
      `customers!reservations_customer_id_fkey ( profile_id )`,
    )
    .eq('id', input.reservationId)
    .maybeSingle();
  const targetProfileId = rsvData?.customers?.profile_id ?? input.actorProfileId;

  const { enqueueNotification } = await import('@/lib/notifications/dispatch');
  await enqueueNotification(
    'reservation_changed',
    { profileId: targetProfileId },
    { reservation_id: input.reservationId, new_start: input.newStartIso },
  );

  return { ok: true, reservationId: input.reservationId };
}
