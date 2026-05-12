/**
 * API013 GET /api/instructor/google-calendar/callback
 *
 * Google OAuth callback。state 検証 → code → tokens 取得 → AES-GCM 暗号化保存。
 * 既存連携があれば上書き。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  decodeIdTokenEmail,
  exchangeCodeForGoogleTokens,
} from '@/lib/google/oauth';
import { encrypt } from '@/lib/encryption';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') {
    return NextResponse.redirect(new URL('/instructor/login?error=forbidden', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const errorParam = request.nextUrl.searchParams.get('error');

  if (errorParam) {
    logger.warn('google calendar callback returned error', { code: errorParam });
    return NextResponse.redirect(new URL('/instructor/calendar?error=provider', request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/instructor/calendar?error=missing_params', request.url));
  }

  const cookieState = request.cookies.get('gcal_oauth_state')?.value;
  const cookieInstructorId = request.cookies.get('gcal_oauth_instructor')?.value;
  if (!cookieState || cookieState !== state || !cookieInstructorId) {
    return NextResponse.redirect(
      new URL('/instructor/calendar?error=state_mismatch', request.url),
    );
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/instructor/google-calendar/callback`;

  let tokens: Awaited<ReturnType<typeof exchangeCodeForGoogleTokens>>;
  try {
    tokens = await exchangeCodeForGoogleTokens(code, redirectUri);
  } catch (e) {
    logger.error('google calendar token exchange failed', { code: (e as Error).message });
    return NextResponse.redirect(new URL('/instructor/calendar?error=token_exchange', request.url));
  }

  if (!tokens.refresh_token) {
    // 既連携の再認可で refresh_token が返らないケース。
    // prompt=consent を強制しているので通常は来ないが、ガードしておく。
    return NextResponse.redirect(new URL('/instructor/calendar?error=no_refresh_token', request.url));
  }

  const accountEmail =
    (tokens.id_token && decodeIdTokenEmail(tokens.id_token)) ?? 'unknown@google';
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const admin = createSupabaseAdminClient();

  // 既存の連携があれば upsert
  const { data: existing } = await admin
    .from('calendar_connections')
    .select('id')
    .eq('instructor_id', cookieInstructorId)
    .maybeSingle();

  const payload = {
    instructor_id: cookieInstructorId,
    google_account_email: accountEmail,
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    expires_at: expiresAt,
    scope: tokens.scope,
    last_synced_at: new Date().toISOString(),
    sync_failures: 0,
  };

  if (existing) {
    const { error } = await admin
      .from('calendar_connections')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      logger.error('calendar_connections update failed', { code: error.code });
      return NextResponse.redirect(
        new URL('/instructor/calendar?error=db_update', request.url),
      );
    }
  } else {
    const { error } = await admin.from('calendar_connections').insert(payload);
    if (error) {
      logger.error('calendar_connections insert failed', { code: error.code });
      return NextResponse.redirect(
        new URL('/instructor/calendar?error=db_insert', request.url),
      );
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'instructor',
    action: 'instructor.calendar_connected',
    target_table: 'calendar_connections',
    target_id: cookieInstructorId,
    after_data: { google_account_email: accountEmail },
  });

  const response = NextResponse.redirect(new URL('/instructor/calendar?connected=1', request.url));
  response.cookies.delete('gcal_oauth_state');
  response.cookies.delete('gcal_oauth_instructor');
  return response;
}
