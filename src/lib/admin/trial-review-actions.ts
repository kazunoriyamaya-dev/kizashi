'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createTrialReservation } from '@/lib/reservations/create-trial';
import { CreateTrialReservationSchema } from '@/lib/validators/trial-reservation';
import { logger } from '@/lib/logger';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('forbidden');
  return me;
}

/**
 * 体験予約承認: trial_pending_reviews を approved にして、保存しておいた payload で予約を実行
 *
 * NOTE: children.trial_used は既に重複検出時 false のはずなので、createTrialReservation を呼ぶことで再度自動割当 + 確定が走る
 */
export async function approveTrialReviewAction(reviewId: string, formData: FormData) {
  const me = await ensureAdmin();
  const note = String(formData.get('note') ?? '').trim();

  const admin = createSupabaseAdminClient();
  const { data: review } = await admin
    .from('trial_pending_reviews')
    .select('id, status, customer_id, child_id, requested_payload')
    .eq('id', reviewId)
    .maybeSingle();
  if (!review || review.status !== 'pending') {
    redirect(`/admin/trial-reviews?error=invalid_state`);
  }

  // customer の profile_id 取得
  const { data: customer } = await admin
    .from('customers')
    .select('profile_id')
    .eq('id', review.customer_id)
    .maybeSingle();
  if (!customer) {
    redirect(`/admin/trial-reviews?error=customer_missing`);
  }

  // requested_payload を再パース
  const parsed = CreateTrialReservationSchema.safeParse({
    ...(review.requested_payload as Record<string, unknown>),
    child_id: review.child_id,
  });
  if (!parsed.success) {
    redirect(`/admin/trial-reviews?error=payload_invalid`);
  }

  // 承認ステータスに更新
  await admin
    .from('trial_pending_reviews')
    .update({
      status: 'approved',
      reviewed_by: me.userId,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq('id', reviewId);

  // 予約作成（重複判定はスキップしたいので fn_create_trial_reservation を直接呼ぶ実装も考えうるが、
  // 承認後は外部一致が解消されることはないため、ここでは autoAssign + RPC を直接呼ぶ専用パスを通す）
  const result = await createTrialReservation(review.customer_id, customer.profile_id, parsed.data);

  if (!result.ok) {
    logger.error('trial approved but reservation failed', { code: result.errorCode });
    redirect(`/admin/trial-reviews?error=${result.errorCode}`);
  }

  // pending を resulting_reservation_id に紐付け
  if (result.status === 'confirmed') {
    await admin
      .from('trial_pending_reviews')
      .update({ resulting_reservation_id: result.reservationId })
      .eq('id', reviewId);
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'trial_pending.approved',
    target_table: 'trial_pending_reviews',
    target_id: reviewId,
    after_data: { note: note || null },
  });

  revalidatePath('/admin/trial-reviews');
  redirect('/admin/trial-reviews?approved=1');
}

/**
 * 体験予約却下
 */
export async function rejectTrialReviewAction(reviewId: string, formData: FormData) {
  const me = await ensureAdmin();
  const note = String(formData.get('note') ?? '').trim();

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('trial_pending_reviews')
    .update({
      status: 'rejected',
      reviewed_by: me.userId,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
    })
    .eq('id', reviewId)
    .eq('status', 'pending');

  if (error) {
    logger.error('trial reject failed', { code: error.code });
    redirect('/admin/trial-reviews?error=reject_failed');
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'trial_pending.rejected',
    target_table: 'trial_pending_reviews',
    target_id: reviewId,
    after_data: { note: note || null },
  });

  revalidatePath('/admin/trial-reviews');
  redirect('/admin/trial-reviews?rejected=1');
}
