/**
 * ステップメール 購読登録 / エンロール
 *
 * 公開フォームから submit された購読を保存し、
 * active な sequence (trigger='subscription' で対象 / trigger_tag マッチ) に自動エンロールする。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface SubscribeInput {
  email: string;
  name?: string;
  source?: string;
  landingPageId?: string;
  sequenceIds?: string[]; // 明示指定がある場合は trigger 設定を無視してこれにエンロール
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SubscribeResult {
  subscriberId: string;
  enrolledSequenceIds: string[];
  isNew: boolean;
}

export async function subscribeAndEnroll(input: SubscribeInput): Promise<SubscribeResult> {
  const admin = createSupabaseAdminClient();

  // 1. upsert subscriber
  const { data: existing, error: selectErr } = await admin
    .from('marketing_email_subscribers')
    .select('id, status, tags')
    .eq('email', input.email)
    .maybeSingle();
  if (selectErr) {
    throw new Error(`subscriber select failed: ${selectErr.code}`);
  }

  let subscriberId: string;
  let isNew = false;
  if (existing) {
    subscriberId = existing.id;
    const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...(input.tags ?? [])]));
    await admin
      .from('marketing_email_subscribers')
      .update({
        name: input.name ?? null,
        landing_page_id: input.landingPageId ?? null,
        tags: mergedTags,
        status: existing.status === 'unsubscribed' ? 'active' : existing.status,
        consent_at: new Date().toISOString(),
        unsubscribed_at: null,
        metadata: input.metadata ?? {},
      })
      .eq('id', subscriberId);
  } else {
    isNew = true;
    const { data: created, error: insertErr } = await admin
      .from('marketing_email_subscribers')
      .insert({
        email: input.email,
        name: input.name ?? null,
        source: input.source ?? 'lp',
        landing_page_id: input.landingPageId ?? null,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
        status: 'active',
      })
      .select('id')
      .single();
    if (insertErr || !created) {
      throw new Error(`subscriber insert failed: ${insertErr?.code ?? 'unknown'}`);
    }
    subscriberId = created.id;
  }

  // 2. enroll
  const sequenceIds = await resolveTargetSequences(input);
  const enrolledIds: string[] = [];

  for (const sequenceId of sequenceIds) {
    const { error: enrollErr } = await admin.from('marketing_email_enrollments').upsert(
      {
        subscriber_id: subscriberId,
        sequence_id: sequenceId,
        next_step_order: 0,
        next_send_at: new Date().toISOString(),
      },
      { onConflict: 'subscriber_id,sequence_id', ignoreDuplicates: true },
    );
    if (enrollErr) {
      logger.warn('sequence enroll failed', { code: enrollErr.code, sequenceId });
      continue;
    }
    enrolledIds.push(sequenceId);
  }

  return { subscriberId, enrolledSequenceIds: enrolledIds, isNew };
}

async function resolveTargetSequences(input: SubscribeInput): Promise<string[]> {
  if (input.sequenceIds && input.sequenceIds.length > 0) return input.sequenceIds;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('marketing_email_sequences')
    .select('id, trigger, trigger_tag')
    .eq('is_active', true);
  if (!data) return [];
  return data
    .filter((s) => {
      if (s.trigger === 'subscription') return true;
      if (s.trigger === 'tag_added' && s.trigger_tag && (input.tags ?? []).includes(s.trigger_tag))
        return true;
      return false;
    })
    .map((s) => s.id);
}
