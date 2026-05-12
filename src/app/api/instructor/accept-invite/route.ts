/**
 * 講師招待受け入れ API
 *
 * フロー:
 *  1. クエリ token を検証（HMAC + 期限）
 *  2. instructors レコードと profile_id を取得
 *  3. パスワード設定 (本人が入力したパスワードで supabase.auth.admin.updateUserById)
 *  4. profile.status を 'active' に
 *  5. instructor.status を 'active' に
 *  6. magic link を発行してそのまま自動ログイン (callback) へ
 *
 * このフローは POST のみ受け付ける（GET は accept-invite ページが使う検証エンドポイント）
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyInviteToken } from '@/lib/auth/invite-token';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

const BodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // (1) トークン検証
  const verified = verifyInviteToken(body.token);
  if (!verified) {
    return NextResponse.json({ error: 'invalid_or_expired_token' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // (2) 講師レコード取得
  const { data: instructor, error: fetchErr } = await admin
    .from('instructors')
    .select('id, profile_id, status, contact_email')
    .eq('id', verified.instructorId)
    .maybeSingle();

  if (fetchErr || !instructor) {
    return NextResponse.json({ error: 'instructor_not_found' }, { status: 404 });
  }
  if (instructor.status === 'active') {
    return NextResponse.json({ error: 'already_activated' }, { status: 409 });
  }
  if (instructor.status === 'deleted' || instructor.status === 'suspended') {
    return NextResponse.json({ error: 'instructor_inactive' }, { status: 403 });
  }

  // (3) パスワード設定 + email 確認
  const { error: updateUserErr } = await admin.auth.admin.updateUserById(instructor.profile_id, {
    password: body.password,
    email_confirm: true,
  });
  if (updateUserErr) {
    logger.error('admin.updateUserById (instructor accept) failed', {
      code: updateUserErr.message,
    });
    return NextResponse.json({ error: 'password_set_failed' }, { status: 500 });
  }

  // (4) profile.status を 'active'
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', instructor.profile_id);
  if (profileErr) {
    logger.error('profiles.status update failed', { code: profileErr.code });
  }

  // (5) instructor.status を 'active'
  const { error: instErr } = await admin
    .from('instructors')
    .update({ status: 'active' })
    .eq('id', instructor.id);
  if (instErr) {
    logger.error('instructors.status update failed', { code: instErr.code });
  }

  // (6) audit_logs
  const { error: auditErr } = await admin.from('audit_logs').insert({
    actor_profile_id: instructor.profile_id,
    actor_role: 'instructor',
    action: 'instructor.accept_invite',
    target_table: 'instructors',
    target_id: instructor.id,
    after_data: { activated_at: new Date().toISOString() },
  });
  if (auditErr) {
    logger.warn('audit_logs insert failed (accept invite)', { code: auditErr.code });
  }

  // 自動ログイン用 magic link 発行
  if (!instructor.contact_email) {
    return NextResponse.json({ ok: true, login_required: true }, { status: 200 });
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: instructor.contact_email,
    options: {
      redirectTo: `${appUrl}/api/auth/callback?redirect_to=${encodeURIComponent('/instructor')}`,
    },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    logger.error('generateLink (instructor accept) failed', { code: linkErr?.message });
    return NextResponse.json({ ok: true, login_required: true }, { status: 200 });
  }

  return NextResponse.json(
    { ok: true, magic_link_redirect: linkData.properties.action_link },
    { status: 200 },
  );
}
