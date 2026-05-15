/**
 * /api/contact - お問い合わせ受信
 *
 * 公開エンドポイント (anon)。
 *  - zod で検証
 *  - 簡易レートリミット (同一 IP ハッシュで 10 分 5 件)
 *  - Resend で運営者宛 (siteConfig.contactEmail) に転送 + ユーザーへ自動返信
 *  - 環境変数 RESEND_API_KEY 未設定なら 503 を返す
 */
import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';
import { siteConfig } from '@/lib/site-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(160),
  topic: z.string().max(80).optional().nullable(),
  body: z.string().min(10).max(4000),
});

// プロセスメモリの簡易レートリミット (10 分窓 5 件)。
// マルチインスタンスでは精度落ちるが、スパムの大規模送信は防げる。
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const hits = new Map<string, number[]>();

function hashIp(ip: string): string {
  const salt = process.env.ENCRYPTION_KEY ?? 'kizashi-default-salt';
  return crypto.createHash('sha256').update(`${salt}:contact:${ip}`).digest('hex').slice(0, 32);
}

function checkRate(key: string): boolean {
  const now = Date.now();
  const list = hits.get(key) ?? [];
  const fresh = list.filter((t) => now - t < RATE_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT) {
    hits.set(key, fresh);
    return false;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  const ipHash = hashIp(ip);

  if (!checkRate(ipHash)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    logger.error('contact form: RESEND_API_KEY 未設定');
    return NextResponse.json({ ok: false, error: 'mailer_unavailable' }, { status: 503 });
  }
  const resend = new Resend(resendKey);
  const fromAddress = process.env.EMAIL_FROM ?? 'noreply@kizashi.example.com';

  // 1) 運営者宛
  try {
    await resend.emails.send({
      from: `${siteConfig.serviceName} お問い合わせ <${fromAddress}>`,
      to: siteConfig.contactEmail,
      replyTo: parsed.data.email,
      subject: `[${siteConfig.serviceName}] お問い合わせ: ${parsed.data.topic ?? 'その他'}`,
      text: `お名前: ${parsed.data.name}\nメール: ${parsed.data.email}\n種別: ${parsed.data.topic ?? '-'}\n\n${parsed.data.body}`,
      html: `
        <p><strong>お名前:</strong> ${escapeHtml(parsed.data.name)}</p>
        <p><strong>メール:</strong> ${escapeHtml(parsed.data.email)}</p>
        <p><strong>種別:</strong> ${escapeHtml(parsed.data.topic ?? '-')}</p>
        <hr />
        <p style="white-space:pre-wrap">${escapeHtml(parsed.data.body)}</p>
      `,
    });
  } catch (e) {
    logger.error('contact form: operator notify failed', {
      message: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    });
    return NextResponse.json({ ok: false, error: 'send_failed' }, { status: 500 });
  }

  // 2) 自動返信
  try {
    await resend.emails.send({
      from: `${siteConfig.serviceName} <${fromAddress}>`,
      to: parsed.data.email,
      subject: `[${siteConfig.serviceName}] お問い合わせを受け付けました`,
      text: `${parsed.data.name} 様\n\nお問い合わせありがとうございます。\n以下の内容で承りました。通常 2 営業日以内にご返信いたします。\n\n----\n種別: ${parsed.data.topic ?? '-'}\n${parsed.data.body}\n----\n\n${siteConfig.serviceName}`,
    });
  } catch (e) {
    // 自動返信失敗は致命的ではないため警告のみ。
    logger.warn('contact form: auto-reply failed', {
      message: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
    });
  }

  return NextResponse.json({ ok: true });
}
