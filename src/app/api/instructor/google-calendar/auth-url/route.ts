/**
 * API012 GET /api/instructor/google-calendar/auth-url
 *
 * 講師が Calendar 連携を開始する。state を HttpOnly Cookie に保存し、
 * Google OAuth 認可 URL にリダイレクト。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildCalendarAuthorizationUrl, generateOAuthState } from '@/lib/google/oauth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10,
};

export async function GET(_request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 講師の contact_email を login_hint に使う
  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id, contact_email')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!instructor) {
    return NextResponse.json({ error: 'instructor_not_found' }, { status: 404 });
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/instructor/google-calendar/callback`;
  const state = generateOAuthState();

  let authUrl: string;
  try {
    authUrl = buildCalendarAuthorizationUrl({
      state,
      redirectUri,
      loginHint: instructor.contact_email ?? undefined,
    });
  } catch (e) {
    logger.error('build google auth url failed', { code: (e as Error).message });
    return NextResponse.json({ error: 'config' }, { status: 500 });
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('gcal_oauth_state', state, COOKIE_OPTIONS);
  response.cookies.set('gcal_oauth_instructor', instructor.id, COOKIE_OPTIONS);
  return response;
}
