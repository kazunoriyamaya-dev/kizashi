/**
 * 認証ヘルパー（Server Component / Route Handler / Server Action 用）
 *
 * 設計書 04_DB_RLS設計 / SEC002:
 * - フロント表示制御だけに依存せず API 側でも必ずロール検証する
 * - profiles.role / profiles.status を取得して判定
 *
 * 使用例:
 *   const user = await requireRole('admin');
 *   const user = await requireRole(['admin', 'instructor']);
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isRole, type Role } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export interface CurrentUser {
  userId: string;
  email: string | null;
  role: Role;
  profileStatus: 'active' | 'suspended' | 'invited' | 'deleted';
  displayName: string;
}

/**
 * 現在のログインユーザーを取得（未ログイン時は null）
 *
 * - auth.users から user 情報を取得
 * - profiles から role / display_name / status を取得
 * - profiles が無い（trigger未発火等）場合は null を返す
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, status, display_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    logger.error('failed to fetch profile in getCurrentUser', { code: profileError.code });
    return null;
  }

  if (!profile) {
    // auth.users はあるが profiles が無い ⇒ trigger 未発火等。即時にプロフィール作成すべきでない
    // (UX 上は /login から再度サインインしてもらう)
    return null;
  }

  if (!isRole(profile.role)) {
    logger.warn('invalid role in profiles', { code: profile.role });
    return null;
  }

  if (profile.status === 'deleted' || profile.status === 'suspended') {
    return null;
  }

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? null,
    role: profile.role,
    profileStatus: profile.status,
    displayName: profile.display_name,
  };
}

/**
 * 指定ロールでのアクセスを必須化。権限不足時は redirect する。
 *
 * - 未ログイン: ロールに応じたログイン画面へ
 * - 別ロール: そのロールの既定画面へ（顧客が /admin を踏んだ場合は /mypage へ）
 * - status='invited' (講師招待中): /instructor/accept-invite へ
 *
 * @param required 必要なロール（単一 or 配列）
 */
export async function requireRole(required: Role | Role[]): Promise<CurrentUser> {
  const requiredRoles = Array.isArray(required) ? required : [required];
  const user = await getCurrentUser();

  if (!user) {
    // 未ログイン: 最初に必要とされるロール用のログイン画面へ
    const target = requiredRoles[0] ?? 'customer';
    if (target === 'admin') redirect('/admin/login');
    if (target === 'instructor') redirect('/instructor/login');
    redirect('/login');
  }

  // 招待中の講師は accept-invite 画面へ誘導
  if (user.role === 'instructor' && user.profileStatus === 'invited') {
    redirect('/instructor/accept-invite');
  }

  if (!requiredRoles.includes(user.role)) {
    // 別ロール: そのロールのデフォルト画面へ
    if (user.role === 'admin') redirect('/admin');
    if (user.role === 'instructor') redirect('/instructor');
    redirect('/mypage');
  }

  return user;
}

/**
 * 既ログインユーザーをロール別の既定画面に流す
 * （ログイン画面で使用）
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  if (user.role === 'admin') redirect('/admin');
  if (user.role === 'instructor') {
    if (user.profileStatus === 'invited') redirect('/instructor/accept-invite');
    redirect('/instructor');
  }
  redirect('/mypage');
}
