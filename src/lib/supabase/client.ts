/**
 * Supabase Browser Client
 *
 * 用途: Client Component から呼び出す Supabase クライアント。
 * RLS が効いた状態で、ログインユーザーの権限内でのみ動作する。
 *
 * Phase 2 で本格実装。
 */
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
