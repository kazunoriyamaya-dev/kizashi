/**
 * 交通費計算ドメイン (F038 / Q008 / Q009)
 *
 * 設計:
 *  - 予約確定後、対面 (onsite) のみ計算
 *  - 講師の base_address → 予約 location_address の片道
 *  - 車: 往復 × 30円/km 切り上げ (Q009)
 *  - 電車: Routes API で取得、不可時は manual=true で requires_admin_review
 *  - travel_fees に1件 upsert（reservation_id UNIQUE）
 *  - 失敗時もログを残す（amount=0, manual=true, requires_admin_review=true）
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { calculateTravelFare } from '@/lib/google/maps';
import { logger } from '@/lib/logger';
import type { TransportationMode } from '@/lib/google/maps';

export interface RecordTravelFeeResult {
  ok: true;
  amount: number;
  manual: boolean;
  requiresAdminReview: boolean;
  travelFeeId: string;
}

export interface RecordTravelFeeError {
  ok: false;
  reason: 'no_instructor_address' | 'no_location_address' | 'unknown';
}

/**
 * 予約 ID から交通費を計算して travel_fees に保存
 *
 * - onsite 予約 + location_address_id が必要
 * - 講師 base_address が必要
 * - 既に travel_fees があれば上書き（再計算）
 */
export async function recordTravelFeeForReservation(
  reservationId: string,
): Promise<RecordTravelFeeResult | RecordTravelFeeError> {
  const admin = createSupabaseAdminClient();

  // 予約取得
  const { data: rsv } = await admin
    .from('reservations')
    .select(
      `id, delivery_type, location_address_id, instructor_id,
       instructors!reservations_instructor_id_fkey ( transportation_mode, base_address_id ),
       addresses!reservations_location_address_id_fkey (
         postal_code, prefecture, city, address_line, building
       )`,
    )
    .eq('id', reservationId)
    .maybeSingle();

  if (!rsv) return { ok: false, reason: 'unknown' };
  if (rsv.delivery_type !== 'onsite' || !rsv.location_address_id || !rsv.addresses) {
    return { ok: false, reason: 'no_location_address' };
  }
  if (!rsv.instructors?.base_address_id) {
    return { ok: false, reason: 'no_instructor_address' };
  }

  // 講師の base_address を取得
  const { data: baseAddr } = await admin
    .from('addresses')
    .select('postal_code, prefecture, city, address_line, building')
    .eq('id', rsv.instructors.base_address_id)
    .maybeSingle();
  if (!baseAddr) return { ok: false, reason: 'no_instructor_address' };

  const mode = (rsv.instructors.transportation_mode ?? 'train') as TransportationMode;

  // 計算
  const result = await calculateTravelFare({
    fromAddress: baseAddr,
    toAddress: rsv.addresses,
    mode,
  });

  // travel_fees upsert (reservation_id は UNIQUE)
  const { data: existing } = await admin
    .from('travel_fees')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle();

  const payload = {
    reservation_id: reservationId,
    mode,
    one_way_distance_km: result.distanceKm ?? null,
    round_trip_distance_km: result.roundTripKm ?? null,
    amount: result.amount,
    is_manual: result.manual,
    manual_reason: result.manualReason ?? null,
    requires_admin_review: result.manual,
    maps_response_summary: result.rawSummary
      ? (result.rawSummary as Record<string, unknown>)
      : null,
  };

  let row: { id: string } | null = null;
  if (existing) {
    const { data, error } = await admin
      .from('travel_fees')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) {
      logger.error('travel_fees update failed', { code: error.code });
      return { ok: false, reason: 'unknown' };
    }
    row = data;
  } else {
    const { data, error } = await admin.from('travel_fees').insert(payload).select('id').single();
    if (error) {
      logger.error('travel_fees insert failed', { code: error.code });
      return { ok: false, reason: 'unknown' };
    }
    row = data;
  }

  return {
    ok: true,
    amount: result.amount,
    manual: result.manual,
    requiresAdminReview: result.manual,
    travelFeeId: row.id,
  };
}

/**
 * 手動入力で travel_fees を上書き
 */
export interface ManualTravelFeeInput {
  reservationId: string;
  mode: TransportationMode;
  amount: number;
  distanceKm?: number | null;
  reason: string;
  actorProfileId: string;
  actorRole: 'admin' | 'instructor';
}

export async function setManualTravelFee(
  input: ManualTravelFeeInput,
): Promise<{ ok: true; travelFeeId: string } | { ok: false; reason: 'unknown' }> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('travel_fees')
    .select('id')
    .eq('reservation_id', input.reservationId)
    .maybeSingle();

  const payload = {
    reservation_id: input.reservationId,
    mode: input.mode,
    one_way_distance_km: input.distanceKm ?? null,
    round_trip_distance_km: input.distanceKm ? Math.ceil(input.distanceKm * 2) : null,
    amount: input.amount,
    is_manual: true,
    manual_reason: input.reason,
    requires_admin_review: false,
    maps_response_summary: null,
  };

  let row: { id: string } | null = null;
  if (existing) {
    const { data, error } = await admin
      .from('travel_fees')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) {
      logger.error('manual travel_fees update failed', { code: error.code });
      return { ok: false, reason: 'unknown' };
    }
    row = data;
  } else {
    const { data, error } = await admin.from('travel_fees').insert(payload).select('id').single();
    if (error) {
      logger.error('manual travel_fees insert failed', { code: error.code });
      return { ok: false, reason: 'unknown' };
    }
    row = data;
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: input.actorProfileId,
    actor_role: input.actorRole,
    action: 'travel_fee.manual_update',
    target_table: 'travel_fees',
    target_id: row.id,
    after_data: {
      amount: input.amount,
      mode: input.mode,
      reason: input.reason,
    },
  });

  return { ok: true, travelFeeId: row.id };
}
