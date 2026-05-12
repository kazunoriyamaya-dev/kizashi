import { describe, it, expect, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger PII フィルタ', () => {
  it('PIIキーは [REDACTED] に置換される', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.info('test', {
      email: 'a@example.com',
      name: '山田太郎',
      phone: '090-0000-0000',
      access_token: 'ya29.xxx',
      ok: 'visible',
    });
    const args = spy.mock.calls.map((c) => c.join(' '));
    const joined = args.join('\n');
    expect(joined).toContain('[REDACTED]');
    expect(joined).not.toContain('a@example.com');
    expect(joined).not.toContain('山田太郎');
    expect(joined).not.toContain('ya29.xxx');
    expect(joined).toContain('visible');
    spy.mockRestore();
  });

  it('ネストオブジェクトも redact', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.info('nest', {
      user: {
        email: 'a@example.com',
        birth_date: '2000-01-01',
      },
      ok: 'visible',
    });
    const joined = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(joined).toContain('[REDACTED]');
    expect(joined).not.toContain('a@example.com');
    expect(joined).not.toContain('2000-01-01');
    spy.mockRestore();
  });
});
