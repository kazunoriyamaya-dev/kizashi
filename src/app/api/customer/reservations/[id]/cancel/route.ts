/**
 * API019 POST /api/customer/reservations/:id/cancel
 *
 * 顧客が自身の予約をキャンセルする。
 * 理由は customer 固定 (Q013)。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cancelReservation } from '@/lib/reservations/cancel';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { note?: string };

  // 顧客自身の予約か検証
  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });

  const { data: rsv } = await supabase
    .from('reservations')
    .select('customer_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!rsv || rsv.customer_id !== customer.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await cancelReservation({
    reservationId: params.id,
    actorProfileId: me.userId,
    actorRole: 'customer',
    reason: 'customer',
    note: body.note ?? null,
    performStripeRefund: true,
  });

  if (!result.ok) {
    const status = result.errorCode === 'reservation_not_found' ? 404 : 422;
    return NextResponse.json({ error: result.errorCode }, { status });
  }

  return NextResponse.json(result);
}
