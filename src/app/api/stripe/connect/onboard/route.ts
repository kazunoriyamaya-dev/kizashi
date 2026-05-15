/**
 * POST /api/stripe/connect/onboard
 *
 * 講師の Stripe Connect オンボーディングを開始
 *  1. createOrGetConnectAccount で Express Account を作成
 *  2. AccountLink を発行
 *  3. 講師を Stripe のオンボーディング画面に redirect
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createAccountOnboardingLink, createOrGetConnectAccount } from '@/lib/stripe/connect';
import { logger } from '@/lib/logger';

export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: instructor } = await admin
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!instructor) {
    return NextResponse.json({ error: 'instructor_not_found' }, { status: 404 });
  }

  try {
    const { accountId } = await createOrGetConnectAccount(instructor.id);
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const url = await createAccountOnboardingLink(
      accountId,
      `${appUrl}/instructor/payouts?connect=return`,
      `${appUrl}/instructor/payouts?connect=refresh`,
    );
    return NextResponse.json({ url });
  } catch (e) {
    logger.error('stripe connect onboard failed', { code: (e as Error).message });
    return NextResponse.json({ error: 'onboard_failed' }, { status: 500 });
  }
}
