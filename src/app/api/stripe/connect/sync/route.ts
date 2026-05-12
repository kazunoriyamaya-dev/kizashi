/**
 * POST /api/stripe/connect/sync
 *
 * Stripe Connect Account の最新状態を取得して DB に同期
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { syncConnectAccountStatus } from '@/lib/stripe/connect';
import { logger } from '@/lib/logger';

export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createSupabaseAdminClient();
  let instructorId: string | null = null;
  if (me.role === 'instructor') {
    const { data: instructor } = await admin
      .from('instructors')
      .select('id')
      .eq('profile_id', me.userId)
      .maybeSingle();
    instructorId = instructor?.id ?? null;
  } else if (me.role === 'admin') {
    // admin が引数で instructor_id を指定する形は別途
    return NextResponse.json({ error: 'pass instructor_id' }, { status: 400 });
  } else {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (!instructorId) {
    return NextResponse.json({ error: 'instructor_not_found' }, { status: 404 });
  }

  const { data: conn } = await admin
    .from('stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('instructor_id', instructorId)
    .maybeSingle();
  if (!conn?.stripe_account_id) {
    return NextResponse.json({ error: 'no_account' }, { status: 404 });
  }

  try {
    const status = await syncConnectAccountStatus(conn.stripe_account_id);
    return NextResponse.json(status);
  } catch (e) {
    logger.error('stripe connect sync failed', { code: (e as Error).message });
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 });
  }
}
