/**
 * 通常予約作成（C005/API016）
 *
 * 設計:
 *  1. address 作成（対面のみ）
 *  2. fn_create_normal_reservation RPC を呼ぶ（チケット消化 + 予約 INSERT）
 *  3. Google Calendar event を作成（Q006: Meet URL 同時発行）
 *  4. fn_attach_calendar_event で event_id / meet_url を予約に反映
 *  5. 通知ログ（メール / LINE / Push）を queued で記録
 *
 * エラーハンドリング:
 *  - 23P01 → time_conflict
 *  - P0001 message=ticket_*_xxx → ticket 系エラー
 *  - その他 → unknown
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createCalendarEvent } from '@/lib/google/calendar';
import { recordTravelFeeForReservation } from '@/lib/reservations/travel-fee';
import { logger } from '@/lib/logger';
import type { CreateNormalReservationInput } from '@/lib/validators/reservation';

export type CreateReservationErrorCode =
  | 'ticket_not_found'
  | 'ticket_owner_mismatch'
  | 'ticket_inactive'
  | 'ticket_remaining_zero'
  | 'ticket_expired'
  | 'instructor_not_found'
  | 'instructor_inactive'
  | 'time_conflict'
  | 'unknown';

export interface CreateReservationResult {
  ok: true;
  reservationId: string;
  designationFee: number;
  newRemainingCount: number;
  meetUrl?: string;
}
export interface CreateReservationError {
  ok: false;
  errorCode: CreateReservationErrorCode;
  detail?: string;
}

export async function createNormalReservation(
  customerId: string,
  customerProfileId: string,
  input: CreateNormalReservationInput,
): Promise<CreateReservationResult | CreateReservationError> {
  const admin = createSupabaseAdminClient();

  // (1) RPC 呼び出し（チケット消化 + 予約 INSERT を1transaction）
  //  - location_address_id は予約成立後に後付けで作成・bind する
  //    (addresses.owner_id の動的 FK 検証で reservation が必要なため)
  const { data: rpcData, error: rpcErr } = await admin.rpc('fn_create_normal_reservation', {
    p_customer_id: customerId,
    p_child_id: input.child_id,
    p_instructor_id: input.instructor_id,
    p_category: input.category,
    p_start_at: input.start_at,
    p_end_at: input.end_at,
    p_duration_min: input.duration_min,
    p_delivery_type: input.delivery_type,
    p_location_address_id: null, // 一旦 null、後で update
    p_customer_ticket_id: input.customer_ticket_id,
    p_pair_participants: input.pair_participants ?? [],
  });

  if (rpcErr) {
    // PostgREST のエラーは code/message を持つ
    if (rpcErr.code === '23P01') {
      return { ok: false, errorCode: 'time_conflict' };
    }
    if (rpcErr.message?.startsWith('ticket_') || rpcErr.message?.startsWith('instructor_')) {
      const code = rpcErr.message as CreateReservationErrorCode;
      return { ok: false, errorCode: code };
    }
    logger.error('reservation rpc failed', { code: rpcErr.code, detail: rpcErr.message });
    return { ok: false, errorCode: 'unknown', detail: rpcErr.code };
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result?.reservation_id) {
    logger.error('reservation rpc returned no id');
    return { ok: false, errorCode: 'unknown' };
  }

  const reservationId = result.reservation_id;

  // (2) onsite なら address を後付けで作成 + bind
  if (input.delivery_type === 'onsite' && input.location) {
    const { data: addr } = await admin
      .from('addresses')
      .insert({
        owner_type: 'reservation_location',
        owner_id: reservationId,
        postal_code: input.location.postal_code ?? null,
        prefecture: input.location.prefecture ?? null,
        city: input.location.city ?? null,
        address_line: input.location.address_line,
        building: input.location.building ?? null,
      })
      .select('id')
      .single();
    if (addr) {
      await admin
        .from('reservations')
        .update({ location_address_id: addr.id })
        .eq('id', reservationId);
    }
  }

  // (3) 対面の場合は交通費を自動計算して travel_fees に保存 (Q009)
  if (input.delivery_type === 'onsite') {
    try {
      await recordTravelFeeForReservation(reservationId);
    } catch (e) {
      logger.warn('travel fee calculation failed', { code: (e as Error).message });
    }
  }

  // (4) Google Calendar event 作成 (Q006 Meet URL 同時発行)
  let meetUrl: string | undefined;
  try {
    // 講師の連絡先メール + 顧客のメール を attendees に
    const { data: instr } = await admin
      .from('instructors')
      .select('contact_email')
      .eq('id', input.instructor_id)
      .maybeSingle();
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', customerProfileId)
      .maybeSingle();
    const attendees = [instr?.contact_email, profile?.email].filter(
      (e): e is string => typeof e === 'string',
    );

    const { data: child } = await admin
      .from('children')
      .select('name')
      .eq('id', input.child_id)
      .maybeSingle();

    const summary = `Kizashi レッスン: ${child?.name ?? ''}`.trim();
    const description = [
      `レッスン形式: ${input.delivery_type === 'onsite' ? '対面' : 'オンライン'}`,
      `予約ID: ${reservationId}`,
    ].join('\n');

    const evt = await createCalendarEvent({
      instructorId: input.instructor_id,
      summary,
      description,
      startISO: input.start_at,
      endISO: input.end_at,
      attendeeEmails: attendees,
      generateMeetLink: input.delivery_type === 'online',
      reservationId,
    });

    await admin.rpc('fn_attach_calendar_event', {
      p_reservation_id: reservationId,
      p_event_id: evt.eventId,
      p_meet_url: evt.meetUrl ?? null,
    });
    meetUrl = evt.meetUrl;
  } catch (e) {
    // Calendar 連携失敗は予約自体は確定しているため warn ログのみ
    logger.warn('calendar event creation failed', { code: (e as Error).message });
  }

  // (4) 通知を 3 チャネルで queue (Phase 13 で実送信)
  const { enqueueNotification } = await import('@/lib/notifications/dispatch');
  await enqueueNotification(
    'reservation_confirmed',
    { profileId: customerProfileId },
    { reservation_id: reservationId },
  );

  return {
    ok: true,
    reservationId,
    designationFee: result.designation_fee ?? 0,
    newRemainingCount: result.remaining_count ?? 0,
    meetUrl,
  };
}
