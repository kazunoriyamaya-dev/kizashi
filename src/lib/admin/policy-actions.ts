'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';

const RuleSchema = z.enum(['full_return', 'half_refund_fee', 'no_return']);

const CancelPolicySchema = z.object({
  free_cancel_minutes_before_start: z.coerce.number().int().min(0).max(10080),
  free_change_minutes_before_start: z.coerce.number().int().min(0).max(10080),
  change_deadline_hours: z.coerce.number().int().min(0).max(720),
  cancel_deadline_hours: z.coerce.number().int().min(0).max(720),
  ticket_return_rule_in_deadline: RuleSchema,
  ticket_return_rule_out_deadline: RuleSchema,
  ticket_return_rule_company: RuleSchema,
  ticket_return_rule_instructor: RuleSchema,
});

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('forbidden');
  return me;
}

/**
 * キャンセルポリシーは履歴を残すため、新規 INSERT で「最新ルール」を更新する。
 * 既存レコードは履歴として保持。
 */
export async function upsertCancelPolicyAction(formData: FormData) {
  const me = await ensureAdmin();
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v;

  const parsed = CancelPolicySchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/admin/policies/cancel?error=validation');
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('cancel_policies')
    .insert({
      ...parsed.data,
      effective_from: new Date().toISOString(),
      updated_by: me.userId,
    })
    .select('id')
    .single();

  if (error || !row) {
    logger.error('cancel policy insert failed', { code: error?.code });
    redirect('/admin/policies/cancel?error=update_failed');
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'cancel_policy.upserted',
    target_table: 'cancel_policies',
    target_id: row.id,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/admin/policies/cancel');
  redirect('/admin/policies/cancel?updated=1');
}
