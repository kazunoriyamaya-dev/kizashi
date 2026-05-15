import { describe, it, expect } from 'vitest';
import { normalizeBlocks } from '@/lib/marketing/landing-pages/render';

describe('LP blocks normalizer', () => {
  it('drops invalid entries', () => {
    const out = normalizeBlocks([
      { kind: 'hero', headline: 'h' },
      { kind: 'unknown' },
      null,
      'string',
      { foo: 'bar' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('hero');
  });

  it('preserves known kinds', () => {
    const blocks = [
      { kind: 'hero', headline: 'h' },
      { kind: 'feature_list', items: [{ title: 't', body: 'b' }] },
      { kind: 'testimonial', items: [{ author: 'a', body: 'b' }] },
      { kind: 'faq', items: [{ q: 'q', a: 'a' }] },
      { kind: 'cta', headline: 'c', ctaLabel: 'cta', ctaUrl: 'https://x.test' },
      { kind: 'form', sequenceId: '00000000-0000-0000-0000-000000000000' },
      { kind: 'rich_text', html: '<p>x</p>' },
    ];
    expect(normalizeBlocks(blocks)).toHaveLength(7);
  });

  it('returns [] for non-array input', () => {
    expect(normalizeBlocks(null)).toEqual([]);
    expect(normalizeBlocks({})).toEqual([]);
    expect(normalizeBlocks('s')).toEqual([]);
  });
});
