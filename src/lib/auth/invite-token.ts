/**
 * 講師招待トークン
 *
 * 設計書 F002 / SEC003:
 * - HMAC-SHA256 で署名し、期限付き
 * - URL に instructorId と expiresAt を埋め込み、改ざん不可
 *
 * フォーマット: base64url(JSON({instructor_id, exp})) + "." + base64url(hmac)
 *
 * 鍵: ENCRYPTION_KEY を流用（OAuth トークン暗号化と同じ鍵で OK、用途は分離）
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';

interface TokenPayload {
  v: typeof TOKEN_VERSION;
  iid: string; // instructor.id
  exp: number; // unix epoch seconds
}

function getSecret(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY 未設定');
  return Buffer.from(raw, 'base64');
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(input: string): Buffer {
  const padded = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

/**
 * 招待トークンを発行
 *
 * @param instructorId 招待対象の instructor.id
 * @param ttlHours 有効時間 (default: 72時間)
 */
export function issueInviteToken(instructorId: string, ttlHours = 72): string {
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    iid: instructorId,
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  const sigB64 = base64url(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * 招待トークンを検証
 *
 * @returns 成功: { instructorId, expiresAt }、失敗: null
 */
export function verifyInviteToken(token: string): { instructorId: string; expiresAt: Date } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  // 署名検証 (timing-safe)
  const expectedSig = createHmac('sha256', getSecret()).update(payloadB64).digest();
  let providedSig: Buffer;
  try {
    providedSig = fromBase64url(sigB64);
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  // payload 復元
  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromBase64url(payloadB64).toString('utf8')) as TokenPayload;
  } catch {
    return null;
  }
  if (payload.v !== TOKEN_VERSION || !payload.iid || !payload.exp) return null;

  // 期限チェック
  if (payload.exp * 1000 < Date.now()) return null;

  return {
    instructorId: payload.iid,
    expiresAt: new Date(payload.exp * 1000),
  };
}
