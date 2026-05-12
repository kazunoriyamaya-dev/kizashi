/**
 * POST /api/instructor/google-calendar/disconnect
 *
 * 講師が Calendar 連携を解除する。
 * - calendar_connections レコードを削除（refresh_token は revoke しない、安全のため Google 側で別途 revoke 推奨）
 * - audit_logs 記録
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: instructor } = await admin
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!instructor) {
    return NextResponse.json({ error: 'instructor_not_found' }, { status: 404 });
  }

  const { error } = await admin
    .from('calendar_connections')
    .delete()
    .eq('instructor_id', instructor.id);

  if (error) {
    logger.error('calendar disconnect failed', { code: error.code });
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'instructor',
    action: 'instructor.calendar_disconnected',
    target_table: 'calendar_connections',
    target_id: instructor.id,
  });

  return NextResponse.json({ ok: true });
}
