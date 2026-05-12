/**
 * Supabase Admin Client (Service Role Key 使用)
 *
 * ⚠️ 重要: このモジュールは絶対にクライアントから import しないこと。
 * - .eslintrc.json の no-restricted-imports でガード
 * - SUPABASE_SERVICE_ROLE_KEY を使うため RLS をバイパスできる
 * - Stripe webhook / Cron / 講師招待 / バッチ処理など、サーバー側の特権処理のみ利用
 *
 * 設計書: 09_Claude指示「禁止事項: service role keyをクライアントに出さない」
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createSupabaseAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      '[supabase/admin] SUPABASE_SERVICE_ROLE_KEY または NEXT_PUBLIC_SUPABASE_URL が未設定',
    );
  }

  // クライアントバンドルに混入していないかをランタイムでチェック
  if (typeof window !== 'undefined') {
    throw new Error('[supabase/admin] クライアント環境からの呼び出しは禁止');
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
