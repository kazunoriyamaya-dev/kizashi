'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * 講師ログイン (email + password)
 *
 * profiles.role が instructor かつ status が active であることを検証。
 * 招待中(invited)の場合は accept-invite に誘導。
 */
export async function signInInstructorAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/instructor/login?error=missing_credentials');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    logger.warn('instructor signin failed', { code: error?.code });
    redirect('/instructor/login?error=invalid_credentials');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'instructor') {
    await supabase.auth.signOut();
    redirect('/instructor/login?error=not_instructor');
  }

  if (profile.status === 'suspended' || profile.status === 'deleted') {
    await supabase.auth.signOut();
    redirect('/instructor/login?error=inactive');
  }

  if (profile.status === 'invited') {
    redirect('/instructor/accept-invite');
  }

  redirect('/instructor');
}
