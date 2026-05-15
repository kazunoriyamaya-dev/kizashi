'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  CreateNormalReservationSchema,
  type CreateNormalReservationInput,
} from '@/lib/validators/reservation';
import { createNormalReservation } from '@/lib/reservations/create';

const ERROR_REDIRECT_MAP: Record<string, string> = {
  ticket_not_found: 'ticket_not_found',
  ticket_owner_mismatch: 'ticket_owner_mismatch',
  ticket_inactive: 'ticket_inactive',
  ticket_remaining_zero: 'ticket_remaining_zero',
  ticket_expired: 'ticket_expired',
  instructor_not_found: 'instructor_not_found',
  instructor_inactive: 'instructor_inactive',
  time_conflict: 'time_conflict',
  unknown: 'unknown',
};

/**
 * 通常予約作成 Server Action
 *
 * 入力は JSON 文字列（複数フィールドを含むため）として FormData で受け取る。
 * フロントは Client Component から fetch でも、form action でも呼び出せる。
 */
export async function createNormalReservationAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    redirect('/login');
  }

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) {
    redirect('/mypage?error=no_customer');
  }

  // FormData → object（pair_participants と location は JSON 文字列で受け取る）
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;

  let parsed: CreateNormalReservationInput;
  try {
    const candidate = {
      ...raw,
      pair_participants: raw.pair_participants ? JSON.parse(String(raw.pair_participants)) : [],
      location: raw.location_json ? JSON.parse(String(raw.location_json)) : null,
      duration_min: Number(raw.duration_min),
    };
    delete (candidate as Record<string, unknown>).location_json;
    parsed = CreateNormalReservationSchema.parse(candidate);
  } catch {
    redirect(`/mypage/reservations/new?instructorId=${raw.instructor_id ?? ''}&error=validation`);
  }

  const result = await createNormalReservation(customer.id, me.userId, parsed);

  if (!result.ok) {
    const code = ERROR_REDIRECT_MAP[result.errorCode] ?? 'unknown';
    redirect(`/mypage/reservations/new?instructorId=${parsed.instructor_id}&error=${code}`);
  }

  revalidatePath('/mypage');
  revalidatePath('/mypage/reservations');
  redirect(`/mypage/reservations/thanks?id=${result.reservationId}`);
}
