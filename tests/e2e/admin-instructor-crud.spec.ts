/**
 * E2E: 管理者の講師登録フロー (Phase 3)
 *
 * 前提:
 *  - seed admin がログイン可能 (admin@kizashi.example.com / パスワードは Supabase Auth で設定)
 *  - Storage state はテスト用 fixture で作成済み（CI 環境で別途用意）
 */
import { test, expect } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'chromium', 'admin flow は desktop chrome のみ');

test('TC003: 管理者が講師を新規登録 + 招待メールを送信', async ({ page }) => {
  // 前提: storage state で admin としてログイン済み
  // ここではログイン後の手順を記述
  await page.goto('/admin/instructors/new');
  await page.getByLabel('本名').fill('テスト講師');
  await page.getByLabel('本名フリガナ').fill('テストコウシ');
  await page.getByLabel('連絡先メール').fill('test-instructor@example.com');
  await page.getByLabel('ニックネーム（公開）').fill('テスト先生');
  await page.getByRole('button', { name: '登録して招待メールを準備' }).click();
  await expect(page).toHaveURL(/\/admin\/instructors\//);
  await expect(page.getByText('講師を登録しました')).toBeVisible();
  await page.getByRole('button', { name: '招待メールを送信' }).click();
  await expect(page.getByText('招待メールを送信しました')).toBeVisible();
});
