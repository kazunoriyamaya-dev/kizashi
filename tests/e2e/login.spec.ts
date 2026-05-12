/**
 * E2E: TC001 / TC004 / TC005 — ログイン + 認可
 *
 * 前提:
 *  - supabase db reset 済み (seed 投入)
 *  - PLAYWRIGHT_BASE_URL に dev サーバー URL
 */
import { test, expect } from '@playwright/test';

test.describe('TC001 顧客ログイン画面', () => {
  test('Google / LINE SSO ボタンが表示される', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Kizashi にログイン' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google でログイン' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'LINE でログイン' })).toBeVisible();
  });
});

test.describe('TC004 ロール制御 (未認証で /admin 直アクセス)', () => {
  test('未ログイン状態で /admin → /admin/login に redirect', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('未ログイン状態で /mypage → /login に redirect', async ({ page }) => {
    await page.goto('/mypage');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未ログイン状態で /instructor → /instructor/login に redirect', async ({ page }) => {
    await page.goto('/instructor');
    await expect(page).toHaveURL(/\/instructor\/login/);
  });
});
