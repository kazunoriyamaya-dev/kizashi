/**
 * API016 POST /api/customer/reservations - 通常予約作成
 *
 * 内部実装は lib/reservations/create.ts に委譲
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateNormalReservationSchema } from '@/lib/validators/reservation';
import { createNormalReservation } from '@/lib/reservations/create';

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateNormalReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: 'customer_not_found' }, { status: 404 });
  }

  const result = await createNormalReservation(customer.id, me.userId, parsed.data);

  if (!result.ok) {
    const status = result.errorCode === 'time_conflict' ? 409 : 422;
    return NextResponse.json({ error: result.errorCode }, { status });
  }

  return NextResponse.json(
    {
      reservation_id: result.reservationId,
      designation_fee: result.designationFee,
      new_remaining_count: result.newRemainingCount,
      meet_url: result.meetUrl,
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ reservations: [], total: 0 });
  }

  const { data, error, count } = await supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       designation_fee, google_meet_url,
       instructors!reservations_instructor_id_fkey ( id, nickname )`,
      { count: 'exact' },
    )
    .eq('customer_id', customer.id)
    .order('start_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  return NextResponse.json({ reservations: data, total: count ?? 0 });
}
