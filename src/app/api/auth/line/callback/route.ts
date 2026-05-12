/**
 * LINE Login Callback
 *
 * フロー:
 *  1. state / nonce を Cookie と照合
 *  2. code を access_token / id_token に交換
 *  3. id_token を検証して LINE userId (sub) を取得
 *  4. Supabase Admin API で:
 *     - 既存ユーザー (user_metadata.line_user_id 一致) を検索
 *     - 無ければ createUser で新規作成（emailは line user id ベースのエイリアス）
 *  5. 同ユーザーに対して generateLink({ type: 'magiclink' }) を発行
 *  6. magic link の token をパースして exchangeCodeForSession でセッション化
 *  7. customers.line_user_id を最新化
 */
import { NextResponse, type NextRequest } from 'next/server';
import {
  exchangeCodeForLineToken,
  fetchLineProfile,
  generateLineEmailAlias,
  verifyLineIdToken,
} from '@/lib/line/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    logger.warn('LINE callback returned error', { code: errorParam });
    return NextResponse.redirect(new URL('/login?error=line_provider', request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=line_missing_params', request.url));
  }

  const cookieState = request.cookies.get('line_oauth_state')?.value;
  const cookieNonce = request.cookies.get('line_oauth_nonce')?.value;
  const redirectTo = request.cookies.get('line_oauth_redirect')?.value || '/mypage';

  if (!cookieState || cookieState !== state || !cookieNonce) {
    return NextResponse.redirect(new URL('/login?error=line_state_mismatch', request.url));
  }

  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/line/callback`;

  let lineSub: string;
  let displayName: string;
  let pictureUrl: string | undefined;
  let email: string | undefined;
  let accessToken: string;

  try {
    const token = await exchangeCodeForLineToken(code, redirectUri);
    accessToken = token.access_token;

    const idTokenPayload = await verifyLineIdToken(token.id_token, cookieNonce);
    lineSub = idTokenPayload.sub;
    displayName = idTokenPayload.name ?? '';
    pictureUrl = idTokenPayload.picture;
    email = idTokenPayload.email;

    if (!displayName) {
      const profile = await fetchLineProfile(accessToken);
      displayName = profile.displayName;
      pictureUrl = pictureUrl ?? profile.pictureUrl;
    }
  } catch (e) {
    logger.error('LINE token exchange/verify failed', { code: (e as Error).message });
    return NextResponse.redirect(new URL('/login?error=line_token', request.url));
  }

  const admin = createSupabaseAdminClient();

  // --- (4) 既存ユーザー検索 ---
  // user_metadata.line_user_id で完全一致を検索
  let supabaseUserId: string | null = null;

  // listUsers は最大 100 件単位。大規模化したら customers.line_user_id ⇒ profile_id 経由検索に切替
  const { data: listResp, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    logger.error('admin.listUsers failed', { code: listErr.message });
    return NextResponse.redirect(new URL('/login?error=line_user_lookup', request.url));
  }
  const matched = listResp.users.find(
    (u) => (u.user_metadata as { line_user_id?: string } | null)?.line_user_id === lineSub,
  );
  supabaseUserId = matched?.id ?? null;

  // --- (4)' なければ新規作成 ---
  const aliasEmail = email ?? generateLineEmailAlias(lineSub);
  if (!supabaseUserId) {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: aliasEmail,
      email_confirm: true,
      user_metadata: {
        line_user_id: lineSub,
        provider: 'line',
        name: displayName,
        picture: pictureUrl,
        role: 'customer',
      },
    });
    if (createErr || !created.user) {
      logger.error('admin.createUser (LINE) failed', { code: createErr?.message });
      return NextResponse.redirect(new URL('/login?error=line_create_user', request.url));
    }
    supabaseUserId = created.user.id;
  } else {
    // 既存ユーザーの metadata を更新
    await admin.auth.admin.updateUserById(supabaseUserId, {
      user_metadata: {
        line_user_id: lineSub,
        provider: 'line',
        name: displayName,
        picture: pictureUrl,
      },
    });
  }

  // --- (5) magic link を発行してセッション化 ---
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: aliasEmail,
    options: {
      redirectTo: `${appUrl}/api/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (linkErr || !linkData?.properties?.action_link) {
    logger.error('generateLink (LINE) failed', { code: linkErr?.message });
    return NextResponse.redirect(new URL('/login?error=line_session', request.url));
  }

  // --- (7) customers.line_user_id を更新 ---
  // (新規作成時は trigger fn_handle_new_user で customers が自動作成されるはず)
  const supabase = createSupabaseServerClient();
  const { error: updateCustomerErr } = await supabase
    .from('customers')
    .update({ line_user_id: lineSub })
    .eq('profile_id', supabaseUserId);
  if (updateCustomerErr) {
    logger.warn('customers.line_user_id update failed', { code: updateCustomerErr.code });
  }

  // magic link の中の URL に redirect することでブラウザが
  // /api/auth/callback?code=... に来てセッション化される
  const cleanedResponse = NextResponse.redirect(linkData.properties.action_link);
  cleanedResponse.cookies.delete('line_oauth_state');
  cleanedResponse.cookies.delete('line_oauth_nonce');
  cleanedResponse.cookies.delete('line_oauth_redirect');
  return cleanedResponse;
}
