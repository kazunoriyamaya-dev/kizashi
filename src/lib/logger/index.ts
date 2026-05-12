/**
 * 個人情報除外ロガー
 *
 * 設計書: 05_API_非機能 SEC003「個人情報をログに出力しない」
 *
 * - PIIフィールド名を自動マスク（name/email/phone/address/birth_date/...）
 * - console.log は ESLint で禁止し、本ロガー経由で出力
 * - 本番では Vercel ログに INFO以上のみ出力
 */

const PII_KEYS = new Set([
  'email',
  'phone',
  'phone_number',
  'name',
  'display_name',
  'parent_name',
  'address',
  'address_line',
  'postal_code',
  'birth_date',
  'kana',
  'access_token',
  'refresh_token',
  'access_token_encrypted',
  'refresh_token_encrypted',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'stripe_session_id',
  'stripe_payment_intent_id',
  'line_user_id',
  'google_sub',
]);

/**
 * オブジェクト中のPIIキーを '[REDACTED]' に置換
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[DEPTH_LIMIT]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redact(v, depth + 1);
      }
    }
    return result;
  }
  return value;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const safe = meta ? (redact(meta) as Record<string, unknown>) : undefined;
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(safe ? { meta: safe } : {}),
  };
  // ESLint で console.log は禁止しているが、ロガー実装は console.error/warn を使う
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(payload));
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(payload));
  } else if (process.env.NODE_ENV !== 'production' || level === 'info') {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(payload));
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => emit('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
