/**
 * Vercel Cron からの呼び出し認証
 *
 * - Vercel Cron は CRON_SECRET を Authorization: Bearer ヘッダーで送る
 *   (vercel.json で設定不要、production の Vercel env として CRON_SECRET を設定すれば自動)
 * - 本実装では Authorization ヘッダー or ?secret=... でも受け付ける（ローカル検証用）
 */
import type { NextRequest } from 'next/server';

export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 未設定なら開発モード扱いで通す
    return process.env.NODE_ENV !== 'production';
  }
  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;
  const query = request.nextUrl.searchParams.get('secret');
  if (query === secret) return true;
  return false;
}
