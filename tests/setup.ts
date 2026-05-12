/**
 * Vitest setup
 *
 * - 環境変数の default 値を投入（暗号化キーなど）
 * - DOM matchers の拡張
 */
import { vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
  // ENCRYPTION_KEY: base64 で 32byte
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
  process.env.APP_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'test';
});

// Supabase / Stripe / Google 関連の SDK は単体テストでは mock しないため、
// それぞれのテスト側で適宜 vi.mock を行う。
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
