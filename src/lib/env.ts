/**
 * 環境変数の型安全アクセサ
 *
 * - クライアント側で使う場合は NEXT_PUBLIC_ プレフィックス必須
 * - サーバー側専用は SUPABASE_SERVICE_ROLE_KEY 等
 *
 * 起動時に必須変数が欠けていたら例外を投げて Fail-fast にする。
 */
import { z } from 'zod';

const ServerEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1).optional(),

  // Google
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_MAPS_API_KEY: z.string().min(1),

  // LINE
  LINE_CLIENT_ID: z.string().min(1).optional(),
  LINE_CLIENT_SECRET: z.string().min(1).optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1).optional(),
  LINE_CHANNEL_SECRET: z.string().min(1).optional(),

  // Email
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),

  // Push
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(1),

  // Cron
  CRON_SECRET: z.string().min(1).optional(),

  // App
  APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/**
 * サーバー側で使う環境変数を取得（クライアントにバンドルされない）
 *
 * Phase 0 ではビルド時バリデーションをスキップし、ランタイム取得のみ提供する。
 * Phase 2 以降で必須化する。
 */
export function getServerEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Phase 0 では警告のみ (.env.local 未設定でも動作確認できるように)
    // eslint-disable-next-line no-console
    console.warn(
      '[env] 必須環境変数が不足しています。.env.local を作成してください:\n' +
        parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
    return process.env as unknown as ServerEnv;
  }
  return parsed.data;
}

/**
 * クライアント側で使える環境変数（NEXT_PUBLIC_ のみ）
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
} as const;
