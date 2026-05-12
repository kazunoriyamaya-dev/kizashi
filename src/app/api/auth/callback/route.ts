/**
 * Supabase OAuth callback
 *
 * Google SSO の戻り先。?code=... を受け取って exchangeCodeForSession でセッション化
 * 完了後はロールに応じて /admin / /instructor / /mypage へリダイレクト
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { defaultPathForRole, isRole } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const requestedRedirect = searchParams.get('redirect_to') || '/mypage';
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    logger.warn('OAuth callback error', { code: searchParams.get('error') });
    return NextResponse.redirect(new URL('/login?error=oauth_provider', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    logger.error('exchangeCodeForSession failed', { code: error?.code });
    return NextResponse.redirect(new URL('/login?error=oauth_exchange', request.url));
  }

  // ロール取得 → 既定画面へ誘導
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || !isRole(profile.role)) {
    return NextResponse.redirect(new URL('/login?error=no_profile', request.url));
  }

  if (profile.status === 'suspended' || profile.status === 'deleted') {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=inactive', request.url));
  }

  // 招待中講師は accept-invite へ
  if (profile.role === 'instructor' && profile.status === 'invited') {
    return NextResponse.redirect(new URL('/instructor/accept-invite', request.url));
  }

  // requested redirect_to がそのロールの領域内なら使う、そうでなければ既定画面へ
  const target =
    requestedRedirect.startsWith(defaultPathForRole(profile.role))
      ? requestedRedirect
      : defaultPathForRole(profile.role);

  return NextResponse.redirect(new URL(target, request.url));
}
