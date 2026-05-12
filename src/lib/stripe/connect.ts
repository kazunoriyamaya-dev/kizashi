/**
 * Stripe Connect Express (Q011)
 *
 * フロー:
 *  1. 講師が「Stripe Connect を始める」 → createOrGetConnectAccount で stripe_account 作成
 *  2. createAccountOnboardingLink で AccountLink を発行 → 講師が Stripe Onboarding 完了
 *  3. callback で syncConnectAccountStatus → DB の charges_enabled / payouts_enabled / onboarding_completed 更新
 *  4. 月次精算確定後、createTransferToInstructor で Stripe Transfer 実行
 */
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

/**
 * 講師の Stripe Connect Account を作成（既存があればそれを返す）
 */
export async function createOrGetConnectAccount(
  instructorId: string,
): Promise<{ accountId: string; created: boolean }> {
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('stripe_connect_accounts')
    .select('id, stripe_account_id')
    .eq('instructor_id', instructorId)
    .maybeSingle();
  if (existing?.stripe_account_id) {
    return { accountId: existing.stripe_account_id, created: false };
  }

  const { data: instructor } = await admin
    .from('instructors')
    .select('contact_email, real_name')
    .eq('id', instructorId)
    .maybeSingle();

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'JP',
    email: instructor?.contact_email ?? undefined,
    business_type: 'individual',
    capabilities: {
      transfers: { requested: true },
    },
    metadata: {
      kizashi_instructor_id: instructorId,
    },
  });

  await admin.from('stripe_connect_accounts').insert({
    instructor_id: instructorId,
    stripe_account_id: account.id,
    onboarding_completed: false,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
  });

  return { accountId: account.id, created: true };
}

/**
 * AccountLink (オンボーディング用 URL) を発行
 */
export async function createAccountOnboardingLink(
  stripeAccountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
    collect: 'eventually_due',
  });
  return link.url;
}

/**
 * Stripe Connect Account の最新状態を DB に同期
 */
export async function syncConnectAccountStatus(
  stripeAccountId: string,
): Promise<{ onboarding_completed: boolean; charges_enabled: boolean; payouts_enabled: boolean }> {
  const stripe = getStripe();
  const acct = await stripe.accounts.retrieve(stripeAccountId);
  const admin = createSupabaseAdminClient();

  const onboardingDone =
    acct.details_submitted &&
    (acct.charges_enabled || acct.payouts_enabled);

  await admin
    .from('stripe_connect_accounts')
    .update({
      onboarding_completed: !!onboardingDone,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      requirements: (acct.requirements ?? null) as unknown as Record<string, unknown>,
      last_synced_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', stripeAccountId);

  return {
    onboarding_completed: !!onboardingDone,
    charges_enabled: !!acct.charges_enabled,
    payouts_enabled: !!acct.payouts_enabled,
  };
}

/**
 * 講師に Transfer 実行（月次精算）
 *
 * - destination は Connect Account ID
 * - 通貨は JPY、整数 (cents 換算不要)
 * - metadata に payout_id と period_month
 */
export async function createTransferToInstructor(input: {
  payoutId: string;
  periodMonth: string;
  stripeAccountId: string;
  amount: number;
}): Promise<Stripe.Transfer> {
  if (input.amount <= 0) {
    throw new Error('amount_zero_or_negative');
  }
  const stripe = getStripe();
  const transfer = await stripe.transfers.create({
    amount: input.amount,
    currency: 'jpy',
    destination: input.stripeAccountId,
    metadata: {
      kizashi_payout_id: input.payoutId,
      kizashi_period_month: input.periodMonth,
    },
    description: `Kizashi 講師精算 ${input.periodMonth}`,
  });
  logger.info?.('stripe transfer created', { code: transfer.id });
  return transfer;
}
