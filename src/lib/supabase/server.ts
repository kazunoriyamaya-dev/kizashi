/**
 * Supabase Server Client
 *
 * 用途: Server Component / Route Handler / Server Action から呼び出す。
 * Cookie ベースのセッション管理を行い、RLS が効いた状態で動作する。
 *
 * Phase 2 で本格実装。
 */
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component から setAll が呼ばれたケースは無視
          // middleware/Server Action 側で更新されるため問題なし
        }
      },
    },
  });
}
