/**
 * API015 GET /api/customer/instructors/:id/slots
 *
 * 講師の空き枠を取得。Phase 4 の fetchAvailableSlots を呼び出し、
 * Google Calendar + DB の予約 + Q005 バッファを統合した結果を返す。
 *
 * Query params:
 *  - from         (ISO8601, 含む)
 *  - to           (ISO8601, 含まない)
 *  - duration_min (60 or 90 など、チケット連動)
 *  - delivery     (online | onsite)
 *  - step_min     (省略時 30)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchAvailableSlots } from '@/lib/reservations/availability';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const durationMin = Number(url.searchParams.get('duration_min') ?? 60);
  const delivery = (url.searchParams.get('delivery') ?? 'online') as 'online' | 'onsite';
  const stepMin = Number(url.searchParams.get('step_min') ?? 30);

  if (!from || !to) {
    return NextResponse.json({ error: 'missing_from_to' }, { status: 400 });
  }
  if (![30, 45, 60, 90, 120].includes(durationMin)) {
    return NextResponse.json({ error: 'invalid_duration' }, { status: 400 });
  }
  if (!['online', 'onsite'].includes(delivery)) {
    return NextResponse.json({ error: 'invalid_delivery' }, { status: 400 });
  }

  try {
    const slots = await fetchAvailableSlots({
      instructorId: params.id,
      fromIso: from,
      toIso: to,
      durationMin,
      deliveryType: delivery,
      stepMin,
    });
    return NextResponse.json({ slots });
  } catch (e) {
    logger.error('slots fetch failed', { code: (e as Error).message });
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
