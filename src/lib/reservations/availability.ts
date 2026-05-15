/**
 * 講師の空き枠（予約可能枠）取得
 *
 * 設計書 API015 / Q005:
 *  - レッスン時間: 60分または90分（チケットに紐づく duration_min）
 *  - 受付時間帯: 9:00-23:00 (system_settings)
 *  - 対面前後バッファ: 60分（system_settings.onsite_buffer_minutes）
 *  - オンラインバッファ: 0分
 *  - 1ヶ月先まで予約可能（system_settings.reservation_window_days）
 *
 * 実装:
 *  1. 指定期間の Google Calendar Free/Busy を取得
 *  2. DB の reservations を取得（confirmed/pending_payment/changed のみ）
 *  3. busy 期間を統合し、duration_min 単位の候補スロットを生成
 *  4. バッファ・営業時間でフィルタ
 */
import { addMinutes, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getFreeBusyForInstructor } from '@/lib/google/calendar';
import { logger } from '@/lib/logger';

export interface AvailabilityRequest {
  instructorId: string;
  fromIso: string; // 候補生成範囲の開始 (含む)
  toIso: string; // 候補生成範囲の終了 (含まない)
  durationMin: number; // チケットの duration_min
  deliveryType: 'online' | 'onsite';
  /** スロット生成のステップ（分）。default: 30 */
  stepMin?: number;
}

export interface AvailableSlot {
  start: string; // ISO8601
  end: string; // ISO8601
}

interface BusyInterval {
  start: Date;
  end: Date;
}

/**
 * 候補スロット生成（duration ごとに stepMin 刻みで開始時刻を作る）
 */
function generateCandidateSlots(
  fromDate: Date,
  toDate: Date,
  durationMin: number,
  stepMin: number,
  openHour: number,
  closeHour: number,
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  let cur = new Date(fromDate);

  while (isBefore(cur, toDate)) {
    const dayStart = startOfDay(cur);
    const businessOpen = addMinutes(dayStart, openHour * 60);
    const businessClose = addMinutes(dayStart, closeHour * 60);

    // この日が候補範囲外なら次の日へ
    if (isAfter(cur, businessClose)) {
      cur = addMinutes(dayStart, 24 * 60); // 翌日 0:00
      continue;
    }

    const slotStart = isBefore(cur, businessOpen) ? businessOpen : cur;
    const slotEnd = addMinutes(slotStart, durationMin);

    if (isAfter(slotEnd, businessClose)) {
      // 今日の営業時間を超える → 翌日へ
      cur = addMinutes(dayStart, 24 * 60);
      continue;
    }

    slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    cur = addMinutes(slotStart, stepMin);
  }

  return slots;
}

/**
 * busy 期間 + バッファ を1つの BusyInterval に拡張する
 */
function expandBusyWithBuffer(
  busy: { start: string; end: string }[],
  bufferMin: number,
): BusyInterval[] {
  return busy.map((b) => ({
    start: addMinutes(new Date(b.start), -bufferMin),
    end: addMinutes(new Date(b.end), bufferMin),
  }));
}

/**
 * 候補スロットが busy と重なるか
 */
function overlapsBusy(slot: AvailableSlot, busy: BusyInterval[]): boolean {
  const slotStart = new Date(slot.start);
  const slotEnd = new Date(slot.end);
  return busy.some(
    (b) =>
      // intervals overlap if not disjoint
      !(isAfter(slotStart, b.end) || isEqual(slotStart, b.end)) &&
      !(isBefore(slotEnd, b.start) || isEqual(slotEnd, b.start)),
  );
}

/**
 * 空き枠取得
 */
export async function fetchAvailableSlots(req: AvailabilityRequest): Promise<AvailableSlot[]> {
  const { instructorId, fromIso, toIso, durationMin, deliveryType, stepMin = 30 } = req;

  const admin = createSupabaseAdminClient();

  // システム設定取得
  const { data: settings } = await admin
    .from('system_settings')
    .select(
      'reservation_open_hour, reservation_close_hour, onsite_buffer_minutes, online_buffer_minutes, reservation_window_days',
    )
    .maybeSingle();

  const openHour = settings?.reservation_open_hour ?? 9;
  const closeHour = settings?.reservation_close_hour ?? 23;
  const onsiteBuf = settings?.onsite_buffer_minutes ?? 60;
  const onlineBuf = settings?.online_buffer_minutes ?? 0;
  const windowDays = settings?.reservation_window_days ?? 30;
  const bufferMin = deliveryType === 'onsite' ? onsiteBuf : onlineBuf;

  const fromDate = new Date(fromIso);
  const requestedToDate = new Date(toIso);
  const maxToDate = addMinutes(new Date(), windowDays * 24 * 60);
  // window 制限を超えない to を採用
  const toDate = isAfter(requestedToDate, maxToDate) ? maxToDate : requestedToDate;

  if (!isAfter(toDate, fromDate)) {
    return [];
  }

  // 1. Google Calendar Free/Busy
  let calendarBusy: { start: string; end: string }[] = [];
  try {
    calendarBusy = await getFreeBusyForInstructor(
      instructorId,
      fromDate.toISOString(),
      toDate.toISOString(),
    );
  } catch (e) {
    logger.warn('calendar freebusy unavailable, continue with DB-only', {
      code: (e as Error).message,
    });
  }

  // 2. DB の予約
  const { data: dbReservations } = await admin
    .from('reservations')
    .select('start_at, end_at, status')
    .eq('instructor_id', instructorId)
    .in('status', ['pending_payment', 'confirmed', 'changed'])
    .gte('start_at', fromDate.toISOString())
    .lt('start_at', toDate.toISOString());

  const dbBusy: { start: string; end: string }[] =
    dbReservations?.map((r) => ({ start: r.start_at, end: r.end_at })) ?? [];

  // 3. バッファ拡張して統合
  const allBusy = expandBusyWithBuffer([...calendarBusy, ...dbBusy], bufferMin);

  // 4. 候補スロット生成
  const candidates = generateCandidateSlots(
    fromDate,
    toDate,
    durationMin,
    stepMin,
    openHour,
    closeHour,
  );

  // 5. 既存予約と重ならないものだけ返す
  const free = candidates.filter((slot) => !overlapsBusy(slot, allBusy));

  return free;
}
