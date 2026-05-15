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
      'rich_text',
    ].includes(kind);
  });
}
