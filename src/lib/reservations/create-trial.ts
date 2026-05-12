/**
 * 体験予約作成 (F030 / API017)
 *
 * フロー:
 *  1. 子供取得 + trial_used チェック
 *  2. Q003 重複判定: 同じ氏名+カナ+生年月日の他人の子供がいるか
 *     - いれば trial_pending_reviews に登録 → status='pending_review' で戻る
 *     - いなければ次へ
 *  3. 自動割当 (autoAssignInstructorForTrial)
 *  4. 候補なし → status='no_slot' で戻る
 *  5. fn_create_trial_reservation RPC (EXCLUDE 制約で時間競合検出)
 *  6. Google Calendar event 作成 + Meet URL (Q006)
 *  7. 通知ログ作成
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createCalendarEvent } from '@/lib/google/calendar';
import { autoAssignInstructorForTrial } from '@/lib/reservations/auto-assign';
import { recordTravelFeeForReservation } from '@/lib/reservations/travel-fee';
import { logger } from '@/lib/logger';
import type { CreateTrialReservationInput } from '@/lib/validators/trial-reservation';

export type CreateTrialErrorCode =
  | 'child_not_found'
  | 'trial_already_used'
  | 'no_available_instructor'
  | 'time_conflict'
  | 'unknown';

export type CreateTrialResult =
  | {
      ok: true;
      status: 'confirmed';
      reservationId: string;
      instructorId: string;
      startAt: string;
      endAt: string;
      meetUrl?: string;
    }
  | {
      ok: true;
      status: 'pending_review';
      reviewId: string;
      matchedChildId: string;
    }
  | {
      ok: false;
      errorCode: CreateTrialErrorCode;
      detail?: string;
    };

export async function createTrialReservation(
  customerId: string,
  customerProfileId: string,
  input: CreateTrialReservationInput,
): Promise<CreateTrialResult> {
  const admin = createSupabaseAdminClient();

  // 1. 子供取得 + 自分の子供であることを確認
  const { data: child } = await admin
    .from('children')
    .select('id, name, kana, birth_date, customer_id, trial_used')
    .eq('id', input.child_id)
    .maybeSingle();

  if (!child || child.customer_id !== customerId) {
    return { ok: false, errorCode: 'child_not_found' };
  }
  if (child.trial_used) {
    return { ok: false, errorCode: 'trial_already_used' };
  }

  // 2. Q003 重複判定: 他の customer 配下に完全一致の子供がいるか
  const { data: duplicates } = await admin.rpc('fn_find_trial_duplicates', {
    p_name: child.name,
    p_kana: child.kana,
    p_birth_date: child.birth_date,
  });

  const externalMatch = (duplicates ?? []).find(
    (d) => d.child_id !== child.id && d.trial_used === true,
  );
  // 「同じ氏名・カナ・生年月日で trial_used=true な別レコード」が見つかったら
  //  →  trial_pending_reviews に登録（管理者承認待ち）

  if (externalMatch) {
    const { data: review, error: regErr } = await admin.rpc('fn_register_trial_pending', {
      p_customer_id: customerId,
      p_child_id: child.id,
      p_matched_child_id: externalMatch.child_id,
      p_requested_payload: {
        category: input.category,
        duration_min: input.duration_min,
        delivery_type: input.delivery_type,
        from_iso: input.from_iso,
        to_iso: input.to_iso,
        preferred_starts: input.preferred_starts ?? [],
      } as unknown as Record<string, unknown>,
    });
    if (regErr) {
      logger.error('register_trial_pending failed', { code: regErr.code });
      return { ok: false, errorCode: 'unknown', detail: regErr.code };
    }
    const reviewId = Array.isArray(review) ? review[0]?.review_id : review?.review_id;
    if (!reviewId) {
      return { ok: false, errorCode: 'unknown' };
    }

    // 管理者向け通知 (全 admin に展開)
    const { enqueueNotification } = await import('@/lib/notifications/dispatch');
    await enqueueNotification('trial_pending_admin', { toAdmins: true }, {
      review_id: reviewId,
      child_id: child.id,
      matched_child_id: externalMatch.child_id,
    });

    return { ok: true, status: 'pending_review', reviewId, matchedChildId: externalMatch.child_id };
  }

  // 3. 自動割当
  const assignment = await autoAssignInstructorForTrial({
    category: input.category,
    fromIso: input.from_iso,
    toIso: input.to_iso,
    durationMin: input.duration_min,
    deliveryType: input.delivery_type,
    preferredStartIsoList: input.preferred_starts,
    stepMin: 30,
  });

  if (!assignment) {
    return { ok: false, errorCode: 'no_available_instructor' };
  }

  // 4. RPC で予約作成
  const { data: rpcData, error: rpcErr } = await admin.rpc('fn_create_trial_reservation', {
    p_customer_id: customerId,
    p_child_id: child.id,
    p_instructor_id: assignment.instructorId,
    p_category: input.category,
    p_start_at: assignment.slot.start,
    p_end_at: assignment.slot.end,
    p_duration_min: input.duration_min,
    p_delivery_type: input.delivery_type,
  });

  if (rpcErr) {
    if (rpcErr.code === '23P01') {
      return { ok: false, errorCode: 'time_conflict' };
    }
    if (rpcErr.message === 'trial_already_used' || rpcErr.message === 'child_not_found') {
      return { ok: false, errorCode: rpcErr.message as CreateTrialErrorCode };
    }
    logger.error('fn_create_trial_reservation failed', { code: rpcErr.code, detail: rpcErr.message });
    return { ok: false, errorCode: 'unknown', detail: rpcErr.code };
  }

  const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!result?.reservation_id) {
    return { ok: false, errorCode: 'unknown' };
  }

  // 5a. 対面の場合は交通費自動計算 (Q009)
  if (input.delivery_type === 'onsite') {
    try {
      await recordTravelFeeForReservation(result.reservation_id);
    } catch (e) {
      logger.warn('trial travel fee calc failed', { code: (e as Error).message });
    }
  }

  // 5b. Google Calendar event + Meet URL
  let meetUrl: string | undefined;
  try {
    const { data: instr } = await admin
      .from('instructors')
      .select('contact_email')
      .eq('id', assignment.instructorId)
      .maybeSingle();
    const { data: profile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', customerProfileId)
      .maybeSingle();

    const attendees = [instr?.contact_email, profile?.email].filter(
      (e): e is string => typeof e === 'string',
    );

    const evt = await createCalendarEvent({
      instructorId: assignment.instructorId,
      summary: `Kizashi 体験レッスン: ${child.name}`,
      description: `体験予約\n予約ID: ${result.reservation_id}`,
      startISO: assignment.slot.start,
      endISO: assignment.slot.end,
      attendeeEmails: attendees,
      generateMeetLink: input.delivery_type === 'online',
      reservationId: result.reservation_id,
    });

    await admin.rpc('fn_attach_calendar_event', {
      p_reservation_id: result.reservation_id,
      p_event_id: evt.eventId,
      p_meet_url: evt.meetUrl ?? null,
    });
    meetUrl = evt.meetUrl;
  } catch (e) {
    logger.warn('trial calendar event failed', { code: (e as Error).message });
  }

  // 6. 通知 (3チャネル)
  const { enqueueNotification: enqueue } = await import('@/lib/notifications/dispatch');
  await enqueue(
    'trial_reservation_confirmed',
    { profileId: customerProfileId },
    { reservation_id: result.reservation_id },
  );

  return {
    ok: true,
    status: 'confirmed',
    reservationId: result.reservation_id,
    instructorId: assignment.instructorId,
    startAt: assignment.slot.start,
    endAt: assignment.slot.end,
    meetUrl,
  };
}
