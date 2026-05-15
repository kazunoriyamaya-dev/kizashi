'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreateTrialReservationSchema } from '@/lib/validators/trial-reservation';
import { createTrialReservation } from '@/lib/reservations/create-trial';

/**
 * Server Action: 体験予約作成
 *
 * 結果:
 *  - confirmed → /mypage/reservations/thanks?id=xxx
 *  - pending_review → /mypage/trial-reservation/pending?id=xxx
 *  - エラー → /mypage/trial-reservation?error=xxx
 */
export async function createTrialReservationAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') redirect('/login');

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) redirect('/mypage?error=no_customer');

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;

  try {
    const preferredStartsStr = String(raw.preferred_starts ?? '');
    const candidate = {
      ...raw,
      duration_min: Number(raw.duration_min),
      preferred_starts: preferredStartsStr ? preferredStartsStr.split(',').filter(Boolean) : [],
    };
    const parsed = CreateTrialReservationSchema.parse(candidate);
    const result = await createTrialReservation(customer.id, me.userId, parsed);

    if (!result.ok) {
      redirect(`/mypage/trial-reservation?error=${result.errorCode}`);
    }
    revalidatePath('/mypage');
    revalidatePath('/mypage/reservations');

    if (result.status === 'pending_review') {
      redirect(`/mypage/trial-reservation/pending?review_id=${result.reviewId}`);
    }
    redirect(`/mypage/reservations/thanks?id=${result.reservationId}`);
  } catch {
    redirect('/mypage/trial-reservation?error=validation');
  }
}
