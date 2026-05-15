'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { cancelReservation } from '@/lib/reservations/cancel';
import { changeReservation } from '@/lib/reservations/change';
import type { CancelReason } from '@/types';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');
  return me;
}

/**
 * 管理者によるキャンセル
 * - reason は customer / company / instructor を選択可
 * - 講師都合の場合は Q014 によりチケット消化なし
 */
export async function adminCancelReservationAction(reservationId: string, formData: FormData) {
  const me = await ensureAdmin();
  const reason = String(formData.get('reason') ?? 'company') as CancelReason;
  const note = String(formData.get('note') ?? '').trim();
  const performStripeRefund = formData.get('refund') === 'on';

  const result = await cancelReservation({
    reservationId,
    actorProfileId: me.userId,
    actorRole: 'admin',
    reason,
    note: note || null,
    performStripeRefund,
  });

  if (!result.ok) {
    redirect(`/admin/reservations/${reservationId}?error=${result.errorCode}`);
  }
  revalidatePath('/admin/reservations');
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirect(`/admin/reservations/${reservationId}?cancelled=1`);
}

/**
 * 管理者による予約強制変更
 */
export async function adminChangeReservationAction(reservationId: string, formData: FormData) {
  const me = await ensureAdmin();
  const newStart = String(formData.get('start_at') ?? '');
  const newEnd = String(formData.get('end_at') ?? '');
  if (!newStart || !newEnd) {
    redirect(`/admin/reservations/${reservationId}?error=validation`);
  }

  const result = await changeReservation({
    reservationId,
    actorProfileId: me.userId,
    actorRole: 'admin',
    newStartIso: newStart,
    newEndIso: newEnd,
  });

  if (!result.ok) {
    redirect(`/admin/reservations/${reservationId}?error=${result.errorCode}`);
  }
  revalidatePath('/admin/reservations');
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirect(`/admin/reservations/${reservationId}?changed=1`);
}
