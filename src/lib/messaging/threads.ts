/**
 * メッセージドメインロジック (F017/F023/F034 + Q015)
 *
 * 設計書:
 *  - 顧客 ⇔ 管理者: customer_id 単位で 1 スレッド (admin_customer)
 *  - 顧客 ⇔ 講師:   customer + instructor の組み合わせで 1 スレッド (instructor_customer)
 *                  講師との会話は予約実績必須
 *  - 講師 ⇔ 管理者: instructor_id 単位で 1 スレッド (admin_instructor)
 *  - 管理者は全スレッド閲覧可 (Q015、利用規約に明記済み)
 *  - メッセージは退会後も保持 (Q020)
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import type { Role } from '@/types';

export type ThreadType = 'admin_customer' | 'instructor_customer' | 'admin_instructor';

export interface ThreadSummary {
  id: string;
  threadType: ThreadType;
  customerId: string | null;
  instructorId: string | null;
  customerName?: string | null;
  instructorNickname?: string | null;
  lastMessageAt: string | null;
  lastMessageBody?: string | null;
  unreadCount: number;
}

export interface ThreadDetail extends ThreadSummary {
  participantInfo: {
    customerName?: string | null;
    customerEmail?: string | null;
    instructorNickname?: string | null;
  };
}

export interface MessageRow {
  id: string;
  threadId: string;
  senderProfileId: string;
  senderRole?: Role;
  senderName?: string;
  body: string;
  createdAt: string;
  readAtByAdmin: string | null;
  readAtByOther: string | null;
}

// =====================================================
// 参加権限の検証
// =====================================================

/**
 * 顧客が指定講師とメッセージできるか (F034)
 *  - 過去 or 未来の予約が1件以上あれば可
 *  - cancelled も含めるかは設計上「予約実績がある = 一度でも予約した」と解釈し、含める
 */
async function customerCanMessageInstructor(
  customerId: string,
  instructorId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('instructor_id', instructorId);
  return (count ?? 0) > 0;
}

// =====================================================
// findOrCreateThread
// =====================================================

export interface FindOrCreateThreadInput {
  threadType: ThreadType;
  customerId?: string | null;
  instructorId?: string | null;
  /** instructor_customer スレッドの seed (任意) */
  seedReservationId?: string | null;
}

export async function findOrCreateThread(
  input: FindOrCreateThreadInput,
): Promise<{ id: string } | { error: 'forbidden' | 'no_reservation' | 'invalid' }> {
  const admin = createSupabaseAdminClient();

  if (input.threadType === 'admin_customer') {
    if (!input.customerId) return { error: 'invalid' };
    const { data: existing } = await admin
      .from('message_threads')
      .select('id')
      .eq('thread_type', 'admin_customer')
      .eq('customer_id', input.customerId)
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data, error } = await admin
      .from('message_threads')
      .insert({
        thread_type: 'admin_customer',
        customer_id: input.customerId,
      })
      .select('id')
      .single();
    if (error || !data) {
      logger.error('thread create failed', { code: error?.code });
      return { error: 'invalid' };
    }
    return { id: data.id };
  }

  if (input.threadType === 'admin_instructor') {
    if (!input.instructorId) return { error: 'invalid' };
    const { data: existing } = await admin
      .from('message_threads')
      .select('id')
      .eq('thread_type', 'admin_instructor')
      .eq('instructor_id', input.instructorId)
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data, error } = await admin
      .from('message_threads')
      .insert({
        thread_type: 'admin_instructor',
        instructor_id: input.instructorId,
      })
      .select('id')
      .single();
    if (error || !data) return { error: 'invalid' };
    return { id: data.id };
  }

  // instructor_customer
  if (!input.customerId || !input.instructorId) return { error: 'invalid' };

  // F034: 予約実績必須
  const canMessage = await customerCanMessageInstructor(input.customerId, input.instructorId);
  if (!canMessage) return { error: 'no_reservation' };

  const { data: existing } = await admin
    .from('message_threads')
    .select('id')
    .eq('thread_type', 'instructor_customer')
    .eq('customer_id', input.customerId)
    .eq('instructor_id', input.instructorId)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data, error } = await admin
    .from('message_threads')
    .insert({
      thread_type: 'instructor_customer',
      customer_id: input.customerId,
      instructor_id: input.instructorId,
      seed_reservation_id: input.seedReservationId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) {
    logger.error('thread create failed (instructor_customer)', { code: error?.code });
    return { error: 'invalid' };
  }
  return { id: data.id };
}

// =====================================================
// listThreadsForUser
// =====================================================

/**
 * ロールに応じて参加 / 監査可能なスレッド一覧を返す
 */
export async function listThreadsForUser(role: Role, profileId: string): Promise<ThreadSummary[]> {
  const admin = createSupabaseAdminClient();

  let query = admin
    .from('message_threads')
    .select(
      `id, thread_type, customer_id, instructor_id, last_message_at,
       customers!message_threads_customer_id_fkey ( parent_name ),
       instructors!message_threads_instructor_id_fkey ( nickname )`,
    )
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (role === 'customer') {
    const { data: customer } = await admin
      .from('customers')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!customer) return [];
    query = query.eq('customer_id', customer.id);
  } else if (role === 'instructor') {
    const { data: instructor } = await admin
      .from('instructors')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (!instructor) return [];
    query = query.eq('instructor_id', instructor.id);
  }
  // admin は全件

  const { data, error } = await query.limit(200);
  if (error) {
    logger.error('threads list failed', { code: error.code });
    return [];
  }

  // 未読カウントと最新メッセージ
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return [];

  const { data: lastMessages } = await admin
    .from('messages')
    .select('thread_id, body, created_at, read_at_by_admin, read_at_by_other')
    .in('thread_id', ids)
    .order('created_at', { ascending: false });

  const byThread = new Map<string, { body: string; createdAt: string }>();
  const unreadByThread = new Map<string, number>();

  for (const m of lastMessages ?? []) {
    if (!byThread.has(m.thread_id)) {
      byThread.set(m.thread_id, { body: m.body, createdAt: m.created_at });
    }
    // 未読: ロールに応じて read_at_by_admin / read_at_by_other を見る
    const unreadField = role === 'admin' ? m.read_at_by_admin : m.read_at_by_other;
    if (!unreadField) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    threadType: r.thread_type as ThreadType,
    customerId: r.customer_id,
    instructorId: r.instructor_id,
    customerName: r.customers?.parent_name ?? null,
    instructorNickname: r.instructors?.nickname ?? null,
    lastMessageAt: r.last_message_at,
    lastMessageBody: byThread.get(r.id)?.body ?? null,
    unreadCount: unreadByThread.get(r.id) ?? 0,
  }));
}

// =====================================================
// getThreadWithMessages
// =====================================================

export async function getThreadWithMessages(
  threadId: string,
  role: Role,
  profileId: string,
): Promise<
  { thread: ThreadDetail; messages: MessageRow[] } | { error: 'forbidden' | 'not_found' }
> {
  const admin = createSupabaseAdminClient();
  const { data: thread } = await admin
    .from('message_threads')
    .select(
      `id, thread_type, customer_id, instructor_id, last_message_at,
       customers!message_threads_customer_id_fkey ( parent_name, profile_id,
         profiles!customers_profile_id_fkey ( email ) ),
       instructors!message_threads_instructor_id_fkey ( nickname )`,
    )
    .eq('id', threadId)
    .maybeSingle();

  if (!thread) return { error: 'not_found' };

  // 参加権限検証
  if (role !== 'admin') {
    if (role === 'customer') {
      const { data: customer } = await admin
        .from('customers')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (!customer || thread.customer_id !== customer.id) {
        return { error: 'forbidden' };
      }
    } else if (role === 'instructor') {
      const { data: instructor } = await admin
        .from('instructors')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();
      if (!instructor || thread.instructor_id !== instructor.id) {
        return { error: 'forbidden' };
      }
    }
  }

  // メッセージ取得
  const { data: messages } = await admin
    .from('messages')
    .select(
      `id, thread_id, sender_profile_id, body, created_at, read_at_by_admin, read_at_by_other,
       profiles!messages_sender_profile_id_fkey ( role, display_name )`,
    )
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(500);

  return {
    thread: {
      id: thread.id,
      threadType: thread.thread_type as ThreadType,
      customerId: thread.customer_id,
      instructorId: thread.instructor_id,
      customerName: thread.customers?.parent_name ?? null,
      instructorNickname: thread.instructors?.nickname ?? null,
      lastMessageAt: thread.last_message_at,
      unreadCount: 0,
      participantInfo: {
        customerName: thread.customers?.parent_name ?? null,
        customerEmail: thread.customers?.profiles?.email ?? null,
        instructorNickname: thread.instructors?.nickname ?? null,
      },
    },
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      threadId: m.thread_id,
      senderProfileId: m.sender_profile_id,
      senderRole: m.profiles?.role as Role | undefined,
      senderName: m.profiles?.display_name ?? undefined,
      body: m.body,
      createdAt: m.created_at,
      readAtByAdmin: m.read_at_by_admin,
      readAtByOther: m.read_at_by_other,
    })),
  };
}

// =====================================================
// sendMessage
// =====================================================

export async function sendMessage(
  threadId: string,
  senderProfileId: string,
  body: string,
): Promise<{ id: string } | { error: 'empty_body' | 'thread_not_found' | 'forbidden' }> {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { error: 'empty_body' };
  if (trimmed.length > 5000) return { error: 'empty_body' };

  const admin = createSupabaseAdminClient();
  // スレッド存在チェック
  const { data: thread } = await admin
    .from('message_threads')
    .select('id')
    .eq('id', threadId)
    .maybeSingle();
  if (!thread) return { error: 'thread_not_found' };

  const { data, error } = await admin
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_profile_id: senderProfileId,
      body: trimmed,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('message insert failed', { code: error?.code });
    return { error: 'forbidden' };
  }
  return { id: data.id };
}

// =====================================================
// markThreadAsRead
// =====================================================

/**
 * ロールに応じて read_at_by_admin / read_at_by_other を NOW に更新
 *  - admin が閲覧 → read_at_by_admin
 *  - それ以外 (customer/instructor) → read_at_by_other
 */
export async function markThreadAsRead(threadId: string, role: Role): Promise<void> {
  const admin = createSupabaseAdminClient();
  const col = role === 'admin' ? 'read_at_by_admin' : 'read_at_by_other';
  await admin
    .from('messages')
    .update({ [col]: new Date().toISOString() })
    .eq('thread_id', threadId)
    .is(col, null);
}
