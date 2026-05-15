'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { recordTravelFeeForReservation, setManualTravelFee } from '@/lib/reservations/travel-fee';

/**
 * 管理者: 交通費を手動入力 (Q008/Q009)
 */
export async function setTravelFeeManualAction(reservationId: string, formData: FormData) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');

  const mode = String(formData.get('mode') ?? 'train') as 'train' | 'car';
  const amount = Number(formData.get('amount') ?? 0);
  const distanceStr = String(formData.get('distance_km') ?? '');
  const distance = distanceStr ? Number(distanceStr) : null;
  const reason = String(formData.get('reason') ?? '').trim() || '手動上書き';

  const result = await setManualTravelFee({
    reservationId,
    mode,
    amount,
    distanceKm: distance,
    reason,
    actorProfileId: me.userId,
    actorRole: 'admin',
  });

  if (!result.ok) {
    redirect(`/admin/reservations/${reservationId}?error=travel_fee_update`);
  }

  revalidatePath(`/admin/reservations/${reservationId}`);
  redirect(`/admin/reservations/${reservationId}?travel_fee_updated=1`);
}

/**
 * 管理者: 交通費を再計算 (Google Maps から再取得)
 */
export async function recalcTravelFeeAction(reservationId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');

  await recordTravelFeeForReservation(reservationId);
  revalidatePath(`/admin/reservations/${reservationId}`);
  redirect(`/admin/reservations/${reservationId}?travel_fee_updated=1`);
}
