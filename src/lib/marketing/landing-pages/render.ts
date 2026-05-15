/**
 * LP の blocks (jsonb) -> HTML (React 要素) レンダラ
 *
 * /lp/[slug] 公開ページから利用。
 */
import type { LandingPageBlock } from '@/lib/marketing/types';

export function normalizeBlocks(raw: unknown): LandingPageBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is LandingPageBlock => {
    if (!b || typeof b !== 'object' || !('kind' in b)) return false;
    const kind = (b as { kind: string }).kind;
    return [
      'hero',
      'feature_list',
      'testimonial',
      'faq',
      'cta',
      'form',
      'trial_cta',
      'rich_text',
    ].includes(kind);
  });
}

/**
 * 体験予約 CTA の既定 URL ビルダー
 *
 * 未ログインユーザーは /login → ログイン後に /mypage/trial-reservation に redirect する。
 * UTM を query に乗せてアトリビューションを保持する。
 */
export function buildTrialCtaUrl(opts: {
  slug?: string;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    content?: string | null;
  };
}): string {
  const params = new URLSearchParams({ redirect_to: '/mypage/trial-reservation' });
  const utm = opts.utm ?? {};
  if (utm.source) params.set('utm_source', utm.source);
  if (utm.medium) params.set('utm_medium', utm.medium);
  if (utm.campaign) params.set('utm_campaign', utm.campaign);
  if (utm.content) params.set('utm_content', utm.content);
  if (opts.slug) params.set('utm_lp', opts.slug);
  return `/login?${params.toString()}`;
}
