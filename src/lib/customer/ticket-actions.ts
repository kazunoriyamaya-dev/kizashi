'use server';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/checkout';
import { logger } from '@/lib/logger';

/**
 * Server Action: Stripe Checkout を開始
 *
 * フォームから POST → Stripe URL に redirect する。
 * クライアント側でクリックされる「購入する」ボタン用。
 */
export async function startCheckoutAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') redirect('/login');

  const ticketId = String(formData.get('ticket_id') ?? '').trim();
  const returnTo = String(formData.get('return_to') ?? '').trim() || undefined;
  if (!ticketId) redirect('/mypage/tickets?error=missing_ticket');

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select(
      `id,
       profiles!customers_profile_id_fkey ( email )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!customer || !customer.profiles?.email) {
    redirect('/mypage/tickets?error=customer_not_found');
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const successUrl = `${appUrl}/mypage/tickets/checkout-complete?session_id={CHECKOUT_SESSION_ID}${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ''}`;
  const cancelUrl = `${appUrl}/mypage/tickets?error=cancelled`;

  let url: string;
  try {
    const result = await createCheckoutSession({
      customerId: customer.id,
      customerEmail: customer.profiles.email,
      ticketId,
      successUrl,
      cancelUrl,
      returnTo,
    });
    url = result.checkoutUrl;
  } catch (e) {
    const message = (e as Error).message;
    logger.error('startCheckoutAction failed', { code: message });
    redirect(`/mypage/tickets?error=${encodeURIComponent(message)}`);
  }

  redirect(url);
}
