/**
 * LINE Login 開始エンドポイント
 *
 * - state / nonce を発行して HttpOnly cookie に保存
 * - LINE 認可エンドポイントにリダイレクト
 */
import { NextResponse, type NextRequest } from 'next/server';
import { buildLineAuthorizationUrl, generateAuthRandomString } from '@/lib/line/auth';
import { logger } from '@/lib/logger';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 10, // 10 分
};

export async function GET(request: NextRequest) {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/line/callback`;
  const requestedRedirect = request.nextUrl.searchParams.get('redirect_to') ?? '/mypage';

  const state = generateAuthRandomString();
  const nonce = generateAuthRandomString();

  let authorizationUrl: string;
  try {
    authorizationUrl = buildLineAuthorizationUrl({ state, nonce, redirectUri });
  } catch (e) {
    logger.error('LINE login start failed', { code: (e as Error).message });
    return NextResponse.redirect(new URL('/login?error=line_config', request.url));
  }

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set('line_oauth_state', state, COOKIE_OPTIONS);
  response.cookies.set('line_oauth_nonce', nonce, COOKIE_OPTIONS);
  response.cookies.set('line_oauth_redirect', requestedRedirect, COOKIE_OPTIONS);
  return response;
}
