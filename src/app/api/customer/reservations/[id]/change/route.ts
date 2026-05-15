/**
 * API018 PATCH /api/customer/reservations/:id/change
 *
 * 顧客が自身の予約の時間/形式/場所を変更する。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { changeReservation } from '@/lib/reservations/change';

const BodySchema = z.object({
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
  delivery_type: z.enum(['online', 'onsite']).optional(),
  location_address_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

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

  const result = await changeReservation({
    reservationId: params.id,
    actorProfileId: me.userId,
    actorRole: 'customer',
    newStartIso: parsed.data.start_at,
    newEndIso: parsed.data.end_at,
    newDeliveryType: parsed.data.delivery_type,
    newLocationAddressId: parsed.data.location_address_id ?? null,
  });

  if (!result.ok) {
    const status =
      result.errorCode === 'time_conflict'
        ? 409
        : result.errorCode === 'reservation_not_found'
          ? 404
          : 422;
    return NextResponse.json({ error: result.errorCode }, { status });
  }

  return NextResponse.json(result);
}
