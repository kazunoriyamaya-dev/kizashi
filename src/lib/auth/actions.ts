'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Server Action: Google SSO ログイン開始
 *
 * Supabase 側で Google プロバイダーを有効にしておく必要がある (config.toml)
 */
export async function signInWithGoogleAction(redirectTo?: string) {
  const supabase = createSupabaseServerClient();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appUrl}/api/auth/callback?redirect_to=${encodeURIComponent(redirectTo ?? '/mypage')}`,
      queryParams: {
        access_type: 'offline', // refresh_token 取得
        prompt: 'consent',
      },
    },
  });

  if (error || !data?.url) {
    logger.error('signInWithOAuth (google) failed', { code: error?.code });
    redirect('/login?error=oauth_init');
  }

  redirect(data.url);
}

/**
 * Server Action: ログアウト
 */
export async function signOutAction(role: 'admin' | 'instructor' | 'customer' = 'customer') {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');

  if (role === 'admin') redirect('/admin/login');
  if (role === 'instructor') redirect('/instructor/login');
  redirect('/login');
}

/**
 * Server Action: 管理者の email + password ログイン
 *
 * 管理者は SSO ではなく email/password を使う想定（社内向け）
 */
export async function signInAdminAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/admin/login?error=missing_credentials');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    logger.warn('admin signin failed', { code: error?.code });
    redirect('/admin/login?error=invalid_credentials');
  }

  // role 検証
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    await supabase.auth.signOut();
    redirect('/admin/login?error=not_admin');
  }
  if (profile.status === 'suspended' || profile.status === 'deleted') {
    await supabase.auth.signOut();
    redirect('/admin/login?error=inactive');
  }

  redirect('/admin');
}
