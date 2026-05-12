/**
 * Google OAuth 2.0 ヘルパー（Calendar 連携専用）
 *
 * 設計書 F022 / SEC006:
 *  - access_type=offline + prompt=consent で refresh_token を確実に取得
 *  - scope: calendar.events (Free/Busy 含む)
 *  - state は HttpOnly cookie で CSRF 対策
 *  - refresh_token / access_token は AES-GCM 暗号化して calendar_connections に保存
 */
import { randomBytes } from 'node:crypto';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
] as const;

export interface CalendarAuthorizationUrlParams {
  state: string;
  redirectUri: string;
  loginHint?: string;
}

export function buildCalendarAuthorizationUrl({
  state,
  redirectUri,
  loginHint,
}: CalendarAuthorizationUrlParams): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID 未設定');

  const url = new URL(GOOGLE_AUTH_BASE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', CALENDAR_SCOPES.join(' '));
  url.searchParams.set('access_type', 'offline'); // refresh_token を取得
  url.searchParams.set('prompt', 'consent'); // 既連携でも refresh_token を再発行
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  if (loginHint) url.searchParams.set('login_hint', loginHint);
  return url.toString();
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string; // 再連携時は返らないことがある
  expires_in: number;
  token_type: 'Bearer';
  scope: string;
  id_token?: string;
}

export async function exchangeCodeForGoogleTokens(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 未設定');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/**
 * 期限切れ access_token を refresh_token で更新
 *
 * 既存 access_token の有効期限が切れた時に呼ぶ。
 * refresh_token は不変（Google が新しいものを返した場合は更新する）。
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 未設定');
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
}

/**
 * id_token または userinfo から email 取得（軽量実装）
 *
 * id_token は JWT（base64url 3 セグメント）。署名検証は省略し、payload の email のみ抽出。
 * Calendar 連携の確定先メールアドレスを取得するためだけに使用。
 */
export function decodeIdTokenEmail(idToken: string): string | null {
  const segments = idToken.split('.');
  if (segments.length !== 3) return null;
  const payloadPart = segments[1];
  if (!payloadPart) return null;
  try {
    const padded = payloadPart.padEnd(payloadPart.length + ((4 - (payloadPart.length % 4)) % 4), '=');
    const json = JSON.parse(
      Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

/**
 * state / nonce 生成
 */
export function generateOAuthState(): string {
  return randomBytes(24).toString('hex');
}
