/**
 * Supabase Middleware Client
 *
 * middleware.ts で使用。Cookie の同期 + getUser() の取得を行う。
 *
 * 重要:
 * - middleware ではレスポンスを書き換えるため、cookies の get/set を NextRequest/NextResponse に紐付ける
 * - getUser() を必ず呼び、Cookie を JWT に同期させる（@supabase/ssr の慣習）
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';
import { publicEnv } from '@/lib/env';

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Cookie 同期のため必須。getSession ではなく getUser を使うこと
  // (getSession は Cookie のみ参照、getUser は Supabase に問い合わせて再認証)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, supabase, user };
}
