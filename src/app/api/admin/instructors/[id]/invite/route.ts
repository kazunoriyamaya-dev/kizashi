/**
 * 講師招待メール送信
 *
 * 認証: admin のみ
 * 動作:
 *  1. 講師レコード取得
 *  2. 招待トークンを発行（ENCRYPTION_KEYで HMAC 署名、72時間有効）
 *  3. メール送信（Phase 13 の Resend 実装で本番化、Phase 2 ではログ記録のみ）
 *  4. email_notification_logs に記録
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { issueInviteToken } from '@/lib/auth/invite-token';
import { logger } from '@/lib/logger';

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  // 認可チェック
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = ParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const instructorId = parsed.data.id;

  const supabase = createSupabaseServerClient();
  const { data: instructor, error: fetchErr } = await supabase
    .from('instructors')
    .select('id, contact_email, profile_id, status, real_name, nickname')
    .eq('id', instructorId)
    .maybeSingle();

  if (fetchErr || !instructor) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!instructor.contact_email) {
    return NextResponse.json({ error: 'missing_contact_email' }, { status: 400 });
  }
  if (instructor.status === 'deleted') {
    return NextResponse.json({ error: 'instructor_deleted' }, { status: 400 });
  }

  // システム設定から招待トークン有効期限を取得
  const { data: settings } = await supabase
    .from('system_settings')
    .select('invite_token_ttl_hours')
    .maybeSingle();
  const ttlHours = settings?.invite_token_ttl_hours ?? 72;

  // トークン発行
  let token: string;
  try {
    token = issueInviteToken(instructorId, ttlHours);
  } catch (e) {
    logger.error('issueInviteToken failed', { code: (e as Error).message });
    return NextResponse.json({ error: 'token_issue_failed' }, { status: 500 });
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const acceptUrl = `${appUrl}/instructor/accept-invite?token=${encodeURIComponent(token)}`;

  // 招待通知 (メールのみ、招待時点で LINE/Push 連携はないため)
  const admin = createSupabaseAdminClient();
  const { enqueueNotification } = await import('@/lib/notifications/dispatch');
  await enqueueNotification(
    'instructor_invite',
    { profileId: instructor.profile_id, channels: ['email'] },
    {
      instructor_id: instructorId,
      nickname: instructor.nickname,
      accept_url: acceptUrl,
      ttl_hours: ttlHours,
    },
  );

  // audit_logs
  const { error: auditErr } = await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'instructor.invite_sent',
    target_table: 'instructors',
    target_id: instructorId,
    after_data: { ttl_hours: ttlHours },
  });
  if (auditErr) {
    logger.error('audit_logs insert failed', { code: auditErr.code });
  }

  return NextResponse.json(
    { ok: true, message: '招待メールを送信しました', accept_url_preview: acceptUrl },
    { status: 202 },
  );
}
