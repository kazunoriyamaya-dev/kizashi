/**
 * API017 POST /api/customer/trial-reservations
 *
 * 体験予約作成 (Q002 期限なし / Q003 重複時管理者承認 / Q004 自動割当)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateTrialReservationSchema } from '@/lib/validators/trial-reservation';
import { createTrialReservation } from '@/lib/reservations/create-trial';

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = CreateTrialReservationSchema.safeParse(body);
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

  const result = await createTrialReservation(customer.id, me.userId, parsed.data);

  if (!result.ok) {
    const status =
      result.errorCode === 'time_conflict'
        ? 409
        : result.errorCode === 'trial_already_used' || result.errorCode === 'child_not_found'
          ? 422
          : 500;
    return NextResponse.json({ error: result.errorCode }, { status });
  }

  return NextResponse.json(result, { status: 201 });
}
