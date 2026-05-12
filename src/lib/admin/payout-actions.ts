'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { computeMonthlyPayouts } from '@/lib/payouts/calculate';
import { createTransferToInstructor } from '@/lib/stripe/connect';
import { logger } from '@/lib/logger';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');
  return me;
}

/**
 * 月次集計の実行
 */
export async function runMonthlyPayoutComputationAction(formData: FormData) {
  await ensureAdmin();
  const period = String(formData.get('period_month') ?? '').slice(0, 7); // YYYY-MM
  const recompute = formData.get('recompute') === 'on';

  if (!/^\d{4}-\d{2}$/.test(period)) {
    redirect('/admin/payouts?error=invalid_period');
  }

  const periodIso = `${period}-01`;
  try {
    await computeMonthlyPayouts(periodIso, recompute);
  } catch (e) {
    logger.error('compute payouts failed', { code: (e as Error).message });
    redirect(`/admin/payouts?period=${period}&error=compute_failed`);
  }

  revalidatePath('/admin/payouts');
  redirect(`/admin/payouts?period=${period}&computed=1`);
}

/**
 * 個別 payout を confirmed に進める
 */
export async function confirmPayoutAction(payoutId: string, formData: FormData) {
  const me = await ensureAdmin();
  const period = String(formData.get('period') ?? '');
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('fn_confirm_payout', {
    p_payout_id: payoutId,
    p_actor_profile_id: me.userId,
  });
  if (error) {
    redirect(`/admin/payouts?period=${period}&error=confirm_failed`);
  }
  revalidatePath('/admin/payouts');
  redirect(`/admin/payouts?period=${period}&confirmed=1`);
}

/**
 * 個別 payout に対して Stripe Transfer を実行 → paid
 */
export async function payInstructorAction(payoutId: string, formData: FormData) {
  const me = await ensureAdmin();
  const period = String(formData.get('period') ?? '');

  const admin = createSupabaseAdminClient();
  const { data: payout } = await admin
    .from('payouts')
    .select(
      `id, instructor_id, instructor_amount, period_month, status,
       instructors!payouts_instructor_id_fkey (
         stripe_connect_accounts ( stripe_account_id, payouts_enabled )
       )`,
    )
    .eq('id', payoutId)
    .maybeSingle();

  if (!payout) redirect(`/admin/payouts?period=${period}&error=not_found`);
  if (payout.status !== 'confirmed') {
    redirect(`/admin/payouts?period=${period}&error=not_confirmed`);
  }
  const connect = payout.instructors?.stripe_connect_accounts?.[0];
  if (!connect?.stripe_account_id || !connect.payouts_enabled) {
    redirect(`/admin/payouts?period=${period}&error=connect_not_ready`);
  }
  if (payout.instructor_amount <= 0) {
    redirect(`/admin/payouts?period=${period}&error=zero_amount`);
  }

  try {
    const transfer = await createTransferToInstructor({
      payoutId,
      periodMonth: payout.period_month,
      stripeAccountId: connect.stripe_account_id,
      amount: payout.instructor_amount,
    });
    await admin.rpc('fn_mark_payout_paid', {
      p_payout_id: payoutId,
      p_actor_profile_id: me.userId,
      p_stripe_transfer_id: transfer.id,
      p_stripe_payout_id: null,
    });
  } catch (e) {
    logger.error('payInstructorAction failed', { code: (e as Error).message });
    redirect(`/admin/payouts?period=${period}&error=transfer_failed`);
  }

  revalidatePath('/admin/payouts');
  redirect(`/admin/payouts?period=${period}&paid=1`);
}
