'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cancelReservation } from '@/lib/reservations/cancel';
import { changeReservation } from '@/lib/reservations/change';

async function ensureCustomerOwns(reservationId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') redirect('/login');
  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) redirect('/mypage');
  const { data: rsv } = await supabase
    .from('reservations')
    .select('customer_id')
    .eq('id', reservationId)
    .maybeSingle();
  if (!rsv || rsv.customer_id !== customer.id) {
    redirect('/mypage/reservations');
  }
  return me;
}

/**
 * 顧客都合キャンセル Server Action
 */
export async function cancelOwnReservationAction(reservationId: string, formData: FormData) {
  const me = await ensureCustomerOwns(reservationId);
  const note = String(formData.get('note') ?? '').trim();

  const result = await cancelReservation({
    reservationId,
    actorProfileId: me.userId,
    actorRole: 'customer',
    reason: 'customer',
    note: note || null,
    performStripeRefund: true,
  });

  if (!result.ok) {
    redirect(`/mypage/reservations/${reservationId}?error=${result.errorCode}`);
  }
  revalidatePath('/mypage/reservations');
  revalidatePath(`/mypage/reservations/${reservationId}`);
  redirect(`/mypage/reservations/${reservationId}?cancelled=1`);
}

/**
 * 顧客の予約変更 Server Action
 */
export async function changeOwnReservationAction(reservationId: string, formData: FormData) {
  const me = await ensureCustomerOwns(reservationId);

  const newStart = String(formData.get('start_at') ?? '');
  const newEnd = String(formData.get('end_at') ?? '');
  if (!newStart || !newEnd) {
    redirect(`/mypage/reservations/${reservationId}/change?error=validation`);
  }

  const result = await changeReservation({
    reservationId,
    actorProfileId: me.userId,
    actorRole: 'customer',
    newStartIso: newStart,
    newEndIso: newEnd,
  });

  if (!result.ok) {
    redirect(`/mypage/reservations/${reservationId}/change?error=${result.errorCode}`);
  }
  revalidatePath('/mypage/reservations');
  revalidatePath(`/mypage/reservations/${reservationId}`);
  redirect(`/mypage/reservations/${reservationId}?changed=1`);
}
