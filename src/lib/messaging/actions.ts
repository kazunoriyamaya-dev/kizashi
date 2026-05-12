'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  findOrCreateThread,
  getThreadWithMessages,
  sendMessage,
} from '@/lib/messaging/threads';
import { logger } from '@/lib/logger';

/**
 * メッセージ送信 Server Action (共通)
 */
export async function sendMessageAction(threadId: string, formData: FormData) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const verify = await getThreadWithMessages(threadId, me.role, me.userId);
  if ('error' in verify) {
    return;
  }
  const result = await sendMessage(threadId, me.userId, body);
  if ('error' in result) {
    logger.warn('sendMessageAction failed', { code: result.error });
    return;
  }
  // 各ロール向けに revalidate
  revalidatePath('/admin/messages');
  revalidatePath('/instructor/messages');
  revalidatePath('/mypage/messages');
  revalidatePath(`/admin/messages/${threadId}`);
  revalidatePath(`/instructor/messages/${threadId}`);
  revalidatePath(`/mypage/messages/${threadId}`);
}

/**
 * 顧客 → 講師 スレッドを開始 (予約済みであれば作成、なければエラー)
 */
export async function openCustomerInstructorThreadAction(instructorId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') redirect('/login');
  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) redirect('/mypage');

  const result = await findOrCreateThread({
    threadType: 'instructor_customer',
    customerId: customer.id,
    instructorId,
  });
  if ('error' in result) {
    if (result.error === 'no_reservation') {
      redirect(`/mypage/instructors/${instructorId}?error=no_reservation`);
    }
    redirect('/mypage/messages?error=open_failed');
  }
  redirect(`/mypage/messages/${result.id}`);
}

/**
 * 顧客 → 管理者 スレッドを開始 (常に1スレッド)
 */
export async function openCustomerAdminThreadAction() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') redirect('/login');
  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) redirect('/mypage');

  const result = await findOrCreateThread({
    threadType: 'admin_customer',
    customerId: customer.id,
  });
  if ('error' in result) redirect('/mypage/messages?error=open_failed');
  redirect(`/mypage/messages/${result.id}`);
}

/**
 * 講師 → 管理者 スレッドを開始
 */
export async function openInstructorAdminThreadAction() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') redirect('/login');
  const admin = createSupabaseAdminClient();
  const { data: instructor } = await admin
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!instructor) redirect('/instructor');

  const result = await findOrCreateThread({
    threadType: 'admin_instructor',
    instructorId: instructor.id,
  });
  if ('error' in result) redirect('/instructor/messages?error=open_failed');
  redirect(`/instructor/messages/${result.id}`);
}

/**
 * 管理者 → 顧客 / 講師 スレッドを開始
 */
export async function openAdminCustomerThreadAction(customerId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');
  const result = await findOrCreateThread({
    threadType: 'admin_customer',
    customerId,
  });
  if ('error' in result) redirect('/admin/messages?error=open_failed');
  redirect(`/admin/messages/${result.id}`);
}

export async function openAdminInstructorThreadAction(instructorId: string) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') redirect('/admin/login');
  const result = await findOrCreateThread({
    threadType: 'admin_instructor',
    instructorId,
  });
  if ('error' in result) redirect('/admin/messages?error=open_failed');
  redirect(`/admin/messages/${result.id}`);
}
