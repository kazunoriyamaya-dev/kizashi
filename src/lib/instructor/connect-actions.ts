'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  createAccountOnboardingLink,
  createOrGetConnectAccount,
  syncConnectAccountStatus,
} from '@/lib/stripe/connect';
import { logger } from '@/lib/logger';

/**
 * 講師が Stripe Connect オンボーディングを開始
 */
export async function startInstructorOnboardingAction() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') redirect('/instructor/login');

  const admin = createSupabaseAdminClient();
  const { data: instructor } = await admin
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!instructor) redirect('/instructor');

  try {
    const { accountId } = await createOrGetConnectAccount(instructor.id);
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const url = await createAccountOnboardingLink(
      accountId,
      `${appUrl}/instructor/payouts?connect=return`,
      `${appUrl}/instructor/payouts?connect=refresh`,
    );
    redirect(url);
  } catch (e) {
    logger.error('startInstructorOnboardingAction failed', { code: (e as Error).message });
    redirect('/instructor/payouts?error=onboard_failed');
  }
}

/**
 * 講師が Stripe Connect の状態を再同期
 */
export async function refreshInstructorConnectStatusAction() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') redirect('/instructor/login');

  const admin = createSupabaseAdminClient();
  const { data: instructor } = await admin
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!instructor) redirect('/instructor');

  const { data: conn } = await admin
    .from('stripe_connect_accounts')
    .select('stripe_account_id')
    .eq('instructor_id', instructor.id)
    .maybeSingle();
  if (!conn?.stripe_account_id) redirect('/instructor/payouts?error=no_account');

  try {
    await syncConnectAccountStatus(conn.stripe_account_id);
  } catch (e) {
    logger.error('refreshInstructorConnectStatusAction failed', { code: (e as Error).message });
  }
  redirect('/instructor/payouts?synced=1');
}
