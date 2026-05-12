/**
 * LINE Login (OAuth 2.0 + OIDC)
 *
 * Supabase Auth は LINE プロバイダー未サポートのため、独自実装。
 *
 * フロー:
 * 1. /api/auth/line/start
 *    - state, nonce を生成して HttpOnly cookie に保存
 *    - LINE 認可エンドポイントにリダイレクト
 * 2. /api/auth/line/callback
 *    - state検証、code でトークン取得
 *    - id_token から sub (LINE User ID) を取得
 *    - Supabase Auth Admin API で対応する auth.users を作成 or 検索
 *    - generateLink で magic link 取得 → exchangeCodeForSession でセッション化
 *    - customers.line_user_id を更新
 *
 * 設計書: F001 / Q016
 */
import { createHash, randomBytes } from 'node:crypto';

const LINE_AUTH_BASE = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

export interface LineAuthorizationParams {
  state: string;
  nonce: string;
  redirectUri: string;
  scope?: string;
}

/**
 * LINE 認可 URL 生成
 */
export function buildLineAuthorizationUrl(params: LineAuthorizationParams): string {
  const clientId = process.env.LINE_CLIENT_ID;
  if (!clientId) {
    throw new Error('LINE_CLIENT_ID 未設定');
  }
  const url = new URL(LINE_AUTH_BASE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('scope', params.scope ?? 'profile openid email');
  url.searchParams.set('bot_prompt', 'aggressive'); // 公式 LINE 友だち追加を促す
  return url.toString();
}

/**
 * code → access_token + id_token を取得
 */
export interface LineTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  scope: string;
  token_type: 'Bearer';
}

export async function exchangeCodeForLineToken(
  code: string,
  redirectUri: string,
): Promise<LineTokenResponse> {
  const clientId = process.env.LINE_CLIENT_ID;
  const clientSecret = process.env.LINE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('LINE_CLIENT_ID / LINE_CLIENT_SECRET 未設定');
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`LINE token exchange failed: ${res.status}`);
  }
  return (await res.json()) as LineTokenResponse;
}

/**
 * id_token を LINE Verify API で検証
 *
 * https://developers.line.biz/ja/docs/line-login/verify-id-token/
 */
export interface LineVerifiedIdToken {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  nonce?: string;
  amr?: string[];
  name?: string;
  picture?: string;
  email?: string;
}

export async function verifyLineIdToken(
  idToken: string,
  expectedNonce: string,
): Promise<LineVerifiedIdToken> {
  const clientId = process.env.LINE_CLIENT_ID;
  if (!clientId) throw new Error('LINE_CLIENT_ID 未設定');

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: clientId,
    nonce: expectedNonce,
  });
  const res = await fetch(LINE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`LINE id_token verify failed: ${res.status}`);
  return (await res.json()) as LineVerifiedIdToken;
}

/**
 * (オプション) アクセストークンで profile を取得（display_name, picture）
 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export async function fetchLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`LINE profile fetch failed: ${res.status}`);
  return (await res.json()) as LineProfile;
}

/**
 * state / nonce 生成
 */
export function generateAuthRandomString(): string {
  return randomBytes(24).toString('hex');
}

/**
 * LINE sub から決定的なメールアドレスを生成（email が無いユーザー用）
 *
 * 同一の LINE User ID から常に同じ email を生成することで、
 * Supabase Auth 側のユーザーマッチングに利用する
 */
export function generateLineEmailAlias(lineUserId: string): string {
  const hash = createHash('sha256').update(lineUserId).digest('hex').slice(0, 16);
  return `line_${hash}@line.kizashi.local`;
}
