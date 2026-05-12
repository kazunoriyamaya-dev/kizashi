# E2E テスト計画 (Phase 14)

## テストケース対応表 (07_テスト)

| ID | 内容 | 区分 | 実装場所 | 自動化状態 |
|---|---|---|---|---|
| TC001 | 顧客 Google SSO 登録 | 正常 | e2e/login.spec.ts | 表示確認のみ自動化、SSO 認可は手動 |
| TC002 | 顧客 LINE SSO 登録 | 正常 | e2e/login.spec.ts | 表示確認のみ自動化 |
| TC003 | 講師招待 | 正常 | e2e/admin-instructor-crud.spec.ts | 自動化 |
| TC004 | 顧客で /admin へ直アクセス | 権限 | e2e/login.spec.ts | 自動化 |
| TC005 | 顧客 A で顧客 B のリソースアクセス | 権限 | docs/test/rls-tests.sql | psql で自動化 |
| TC006 | 講師一覧の公開情報のみ表示 | 正常 | docs/test/rls-tests.sql + 単体 (instructors_public) | 自動化 |
| TC007 | 通常予約 (チケット保有) | 正常 | e2e/reservation-create.spec.ts (※要実装) | 手動推奨 (Stripe sandbox) |
| TC008 | チケット残数 0 で予約 → 購入画面遷移 | 異常 | e2e/reservation-create.spec.ts | 手動推奨 |
| TC009 | Stripe Checkout 成功 | 正常 | Stripe CLI + e2e | 手動推奨 |
| TC010 | Webhook 同一イベント二重受信 | 異常 | tests/unit/stripe-webhook.test.ts (※要実装) | 自動化 |
| TC011 | 体験予約 | 正常 | e2e/trial-reservation.spec.ts (※要実装) | 自動化候補 |
| TC012 | 体験予約 既利用 | 異常 | 単体 + e2e | 自動化候補 |
| TC013 | 二重予約防止 | 異常 | docs/test/rls-tests.sql の EXCLUDE 確認 | 自動化 |
| TC014 | Google Calendar 空き枠取得 | 正常 | 手動 (Calendar mock 必要) | 手動 |
| TC015 | Calendar token 期限切れ → refresh | 異常 | 単体 (lib/google/oauth.test.ts) | 手動 |
| TC016 | 交通費 車 30円/km 計算 | 正常 | tests/unit/utils.test.ts (calcCarFare) | 自動化 |
| TC017 | 交通費 電車運賃取得 | 正常 | 手動 (Routes API 要) | 手動 |
| TC018 | 予約変更 期限内 | 正常 | e2e + 単体 cancel-policy.test.ts | 一部自動化 |
| TC019 | 予約変更 期限外 | 異常 | 単体 cancel-policy.test.ts | 自動化 |
| TC020 | 予約キャンセル 期限内 | 正常 | 単体 cancel-policy.test.ts | 自動化 |
| TC021 | 予約キャンセル 期限外 (chu消化) | 異常 | 単体 cancel-policy.test.ts | 自動化 |
| TC022 | メッセージ送受信 | 正常 | e2e (※要実装) | 手動推奨 |
| TC023 | 未予約講師にメッセージ | 権限 | 単体 + e2e | 一部自動化 |
| TC024 | 講師論理削除 | 正常 | 単体 + 手動 | 自動化候補 |
| TC025 | 監査ログの記録 | 正常 | docs/test/rls-tests.sql | 自動化 |

## ローカル実行

```bash
# 単体テスト
pnpm test
pnpm test:watch

# E2E (要 dev サーバー)
pnpm exec playwright install --with-deps
pnpm test:e2e

# RLS テスト (要 supabase ローカル起動)
psql postgresql://postgres:postgres@localhost:54322/postgres \
  -f docs/test/rls-tests.sql
```

## CI での実行

GitHub Actions の `.github/workflows/test.yml` (任意で追加):
1. `supabase start` (Docker)
2. `supabase db reset`
3. `pnpm install && pnpm gen:types`
4. `pnpm lint && pnpm type-check && pnpm test`
5. `pnpm exec playwright install --with-deps && pnpm test:e2e`

## 認証 fixture について

E2E で認証済み状態を再現するには、Playwright の `storageState` を活用:

```ts
import { test as setup } from '@playwright/test';
setup('admin login', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('メールアドレス').fill('admin@kizashi.example.com');
  await page.getByLabel('パスワード').fill('...');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.context().storageState({ path: 'tests/e2e/.auth/admin.json' });
});
```

そして本テストで `test.use({ storageState: '...' })` を呼ぶ。

## 注意事項

- Google OAuth / LINE Login は外部認証のため、E2E では mock 化困難
- 本番ライクな環境を持つ staging を用意して手動テストを推奨
- Stripe は test mode + CLI で webhook 転送、テストカード `4242 ...`
