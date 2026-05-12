/**
 * ロール別ルーティングガード
 *
 * 設計書 04_DB_RLS設計 / TC004 / TC005:
 *  - フロント側でも URL 直打ちで他ロールの画面に到達できないようガード
 *  - API 側でも別途 requireRole() で再検証する
 *
 * 経路:
 *  1. updateSupabaseSession() で Cookie を最新化し user を取得
 *  2. URL から要求ロールを判定
 *  3. 未認証 → ロール別ログイン画面
 *  4. 別ロール → そのロールの既定画面へ redirect
 *  5. 講師 status='invited' → /instructor/accept-invite へ
 */
import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';
import type { Role } from '@/lib/permissions';
import type { Database } from '@/types/database';

// パブリック（ログイン不要）パス
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/admin/login',
  '/instructor/login',
  '/instructor/accept-invite',
  '/api/auth/callback',
  '/api/auth/line/start',
  '/api/auth/line/callback',
  '/api/instructor/accept-invite',
  // Webhook 系は middleware を通さない（route handler 側で署名検証）
];

// パスから要求ロールを推定
function inferRequiredRole(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/instructor')) return 'instructor';
  if (pathname.startsWith('/mypage')) return 'customer';
  if (pathname.startsWith('/api/admin')) return 'admin';
  if (pathname.startsWith('/api/instructor')) return 'instructor';
  if (pathname.startsWith('/api/customer')) return 'customer';
  return null;
}

function loginPathFor(role: Role | null): string {
  if (role === 'admin') return '/admin/login';
  if (role === 'instructor') return '/instructor/login';
  return '/login';
}

function defaultPathFor(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  return '/mypage';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開パスは認証不要
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    // ただし Cookie 同期だけは行う（既ログイン状態を維持）
    const { response } = await updateSupabaseSession(request);
    return response;
  }

  // Cookie 同期 + user 取得
  const { response, supabase, user } = await updateSupabaseSession(request);

  const requiredRole = inferRequiredRole(pathname);

  // ガード対象でない場合（/api/stripe/webhook など）はスルー
  if (!requiredRole) {
    return response;
  }

  // 未ログイン
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPathFor(requiredRole);
    loginUrl.searchParams.set('redirect_to', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ロール取得
  type ProfilesRow = Database['public']['Tables']['profiles']['Row'];
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle<Pick<ProfilesRow, 'role' | 'status'>>();

  if (!profile) {
    // profile 未作成。サインインフローからやり直し
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPathFor(requiredRole);
    return NextResponse.redirect(loginUrl);
  }

  // 停止中・削除済みは即ログアウト相当
  if (profile.status === 'suspended' || profile.status === 'deleted') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPathFor(requiredRole);
    loginUrl.searchParams.set('reason', 'inactive');
    const res = NextResponse.redirect(loginUrl);
    // Supabase クッキーは next/middleware で個別削除しない（auth signOut は別途）
    return res;
  }

  // 講師の招待中状態はプロフィール完成画面へ
  if (
    profile.role === 'instructor' &&
    profile.status === 'invited' &&
    pathname !== '/instructor/accept-invite'
  ) {
    const acceptUrl = request.nextUrl.clone();
    acceptUrl.pathname = '/instructor/accept-invite';
    return NextResponse.redirect(acceptUrl);
  }

  // ロール不一致
  if (profile.role !== requiredRole) {
    const target = request.nextUrl.clone();
    target.pathname = defaultPathFor(profile.role as Role);
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除外:
     * - api/stripe/webhook (Stripe 側からの POST、署名検証で完結)
     * - api/line/notify (Webhook)
     * - api/cron (Vercel Cron)
     * - _next/static, _next/image
     * - favicon.ico, public files
     */
    '/((?!api/stripe/webhook|api/line/webhook|api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
