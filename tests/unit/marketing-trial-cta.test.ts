import { describe, it, expect } from 'vitest';
import { buildTrialCtaUrl, normalizeBlocks } from '@/lib/marketing/landing-pages/render';

describe('buildTrialCtaUrl (新規顧客 体験予約 CTA)', () => {
  it('未ログイン顧客向けに /login?redirect_to=/mypage/trial-reservation を返す', () => {
    const url = buildTrialCtaUrl({});
    expect(url).toContain('/login?');
    expect(url).toContain('redirect_to=%2Fmypage%2Ftrial-reservation');
  });

  it('UTM パラメータを付与する', () => {
    const url = buildTrialCtaUrl({
      slug: 'summer-2026',
      utm: { source: 'lp', medium: 'organic', campaign: 'summer-2026', content: 'hero' },
    });
    expect(url).toContain('utm_source=lp');
    expect(url).toContain('utm_medium=organic');
    expect(url).toContain('utm_campaign=summer-2026');
    expect(url).toContain('utm_content=hero');
    expect(url).toContain('utm_lp=summer-2026');
  });

  it('null/undefined の UTM は無視する', () => {
    const url = buildTrialCtaUrl({ utm: { source: null, medium: 'organic' } });
    expect(url).not.toContain('utm_source=');
    expect(url).toContain('utm_medium=organic');
  });
});

describe('LP blocks: trial_cta 種別が許可される', () => {
  it('trial_cta は normalizeBlocks を通過する', () => {
    const out = normalizeBlocks([
      {
        kind: 'trial_cta',
        headline: '無料体験から',
        bullets: ['1 人 1 回まで無料'],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('trial_cta');
  });
});
