/**
 * /r/[code] - アフィリエイト リダイレクト
 *
 * - クリック記録 (fn_record_affiliate_click)
 * - UTM 付き redirect 302
 */
import { NextResponse, type NextRequest } from 'next/server';
import { trackAndResolve } from '@/lib/marketing/affiliate/tracker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const userAgent = req.headers.get('user-agent');
  const referrer = req.headers.get('referer');

  const result = await trackAndResolve({ code: params.code, ip, userAgent, referrer });
  if (!result.ok || !result.target) {
    return NextResponse.redirect(new URL('/', req.url), 302);
  }
  return NextResponse.redirect(result.target, 302);
}
