# Kizashi 予約管理システム

小中学生向けパーソナルサービス「Kizashi」の予約管理システム。
Next.js 14 / TypeScript / Supabase / Stripe / Vercel 構成。

## ステータス

**Phase 0 - Phase 14 全完了 / リリース判定可能状態**

| Phase | 内容 | 状態 |
|---|---|---|
| P0  | プロジェクト初期化 | ✅ 完了 |
| P1  | DB / RLS 基盤 (27 テーブル / 19 マイグレーション) | ✅ 完了 |
| P2  | 認証 / ロール制御 (Email / Google / LINE) | ✅ 完了 |
| P3  | 管理者マスタ (A001–A017) | ✅ 完了 |
| P4  | 講師プロフィール / Google Calendar 連携 | ✅ 完了 |
| P5  | 顧客基本画面 (C001–C006) | ✅ 完了 |
| P6  | 通常予約フロー (RPC + EXCLUDE 制約) | ✅ 完了 |
| P7  | Stripe 決済 (Checkout + Webhook + 手数料補正) | ✅ 完了 |
| P8  | 体験予約 (Q003 / Q021 重複は admin 承認) | ✅ 完了 |
| P9  | 予約変更 / キャンセル (Q013 / Q014) | ✅ 完了 |
| P10 | メッセージ (admin↔顧客 / admin↔講師) | ✅ 完了 |
| P11 | 交通費計算 (Routes API + Q009 切上げ) | ✅ 完了 |
| P12 | 精算 / 月次処理 (Stripe Connect + balance_transaction) | ✅ 完了 |
| P13 | 通知 3 チャネル (Resend / LINE / Web Push) | ✅ 完了 |
| P14 | テスト / セキュリティ強化 / 運用文書 | ✅ 完了 |
| P15 | マーケティング自動化システム (SNS/LINE/ステップメール/LP/ブログ/アフィリ/広告) | ✅ 完了 (MVP 骨組み) |

### 規模

- **TypeScript / TSX**: 183 ファイル
- **SQL マイグレーション**: 19 ファイル
- **DB テーブル**: 27 テーブル (全 RLS 適用済)
- **PL/pgSQL 関数**: 14 関数 (`security definer` + `revoke from public`)
- **API Route**: 36 ハンドラ
- **画面**: 40 画面 (admin 17 / instructor 8 / customer 15)
- **通知テンプレート**: 12 種類 × 5 チャネル (subject/text/html/push/line)
- **Vercel Cron**: 4 ジョブ
- **単体テスト**: 7 スイート (Vitest)
- **E2E**: 2 スイート (Playwright)

## 必要環境

- **Node.js**: 20.10 以上
- **pnpm**: 9.x（推奨）
- **Supabase CLI**: 2.x（DB マイグレーション用）
- **Stripe CLI**: Webhook ローカル検証用

## セットアップ手順

### 1. リポジトリの取得と依存関係のインストール

```bash
git clone <repo-url> kizashi
cd kizashi
pnpm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を開いて以下の値を埋める：

| カテゴリ | 必須 | 取得方法 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase ダッシュボード > Project Settings > API |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe ダッシュボード |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ✅ | Stripe Connect Webhook 別エンドポイント |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google Cloud Console > OAuth 2.0 |
| `GOOGLE_MAPS_API_KEY` | ✅ | Google Cloud Console > Routes API |
| `LINE_CLIENT_ID` / `LINE_CLIENT_SECRET` | ✅ | LINE Developers Console (LINE Login) |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | ✅ | LINE Developers Console (Messaging API) |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ | Resend ダッシュボード |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | ✅ | `npx web-push generate-vapid-keys` |
| `ENCRYPTION_KEY` | ✅ | `openssl rand -base64 32` |
| `CRON_SECRET` | ✅ | `openssl rand -hex 32` |
| `APP_URL` | ✅ | 本番ドメイン `https://kizashi.example.com` |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` / `STRIPE_SECRET_KEY` / `ENCRYPTION_KEY` / `CRON_SECRET` は **絶対にクライアントへ露出させない**。`.eslintrc.json` に `no-restricted-imports` を設定してガードしている。

### 3. ローカル DB と型生成

```bash
supabase start           # Docker でローカル Supabase 起動
supabase db reset        # マイグレーション + seed 適用
pnpm gen:types           # supabase/types/database.ts 自動生成
```

### 4. ローカル起動 + Stripe Webhook 監視

```bash
pnpm dev
# 別ターミナル
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe listen --forward-to localhost:3000/api/stripe/connect-webhook --connect
```

ブラウザで http://localhost:3000 を開く。seed で作成された admin / instructor / customer でログイン可能。

### 5. ユニットテスト / E2E

```bash
pnpm test                # Vitest (jsdom)
pnpm test:e2e            # Playwright (desktop-chrome / mobile-iphone)
```

## ディレクトリ構成

```
kizashi/
├── docs/                               # 設計書・実装方針・運用ドキュメント
│   ├── 00_実装方針_QA反映版.md
│   ├── Phase{0..14}_完了報告.md
│   ├── 運用_バックアップ.md
│   ├── 運用_ロールバック.md
│   ├── 運用_本番デプロイ.md
│   └── test/rls-tests.sql              # RLS 逆引きテスト (psql)
├── public/
│   ├── sw.js                           # Web Push Service Worker
│   └── icon-192.png                    # 通知アイコン
├── src/
│   ├── app/
│   │   ├── (auth)/                     # ログイン / コールバック
│   │   ├── (admin)/admin/              # A001-A017
│   │   ├── (instructor)/instructor/    # I001-I008
│   │   ├── (customer)/mypage/          # C001-C015
│   │   ├── api/
│   │   │   ├── auth/{google,line}/callback
│   │   │   ├── stripe/{webhook,connect-webhook}
│   │   │   ├── push/subscribe
│   │   │   ├── cron/{dispatch-notifications,notify-ticket-expiring,sweep-expired-tickets,notify-reservation-reminder}
│   │   │   ├── admin/...
│   │   │   ├── instructor/...
│   │   │   └── customer/...
│   │   ├── layout.tsx / page.tsx / error.tsx / not-found.tsx
│   ├── components/
│   │   ├── ui/                         # shadcn/ui
│   │   ├── layout/
│   │   ├── admin/ instructor/ customer/
│   │   ├── forms/
│   │   └── tables/
│   ├── lib/
│   │   ├── supabase/{client,server,admin}
│   │   ├── stripe/{checkout,webhook,connect,refund}
│   │   ├── google/{oauth,calendar,maps}
│   │   ├── line/{login,messaging}
│   │   ├── auth/{invite-token, ...}
│   │   ├── permissions/
│   │   ├── validators/
│   │   ├── notifications/{templates,email,line,push,dispatch,cron-auth}
│   │   ├── reservations/{create,create-trial,cancel,change,cancel-policy}
│   │   ├── tickets/
│   │   ├── transportation/{calculate}
│   │   ├── payout/
│   │   ├── encryption/
│   │   ├── logger/                     # PII フィルタ
│   │   ├── env.ts
│   │   └── utils.ts                    # calcCarFare 等
│   ├── types/{database.ts,index.ts}
│   └── middleware.ts
├── supabase/
│   ├── migrations/                     # 19 SQL
│   └── seed.sql
├── tests/
│   ├── setup.ts
│   ├── unit/                           # 7 ユニットテスト
│   └── e2e/                            # 2 E2E + README.md (TC マップ)
├── playwright.config.ts
├── vitest.config.ts
├── vercel.json                         # Cron 設定
├── .env.example / .eslintrc.json / .prettierrc.json
└── package.json / tsconfig.json / next.config.mjs / tailwind.config.ts
```

## スクリプト

| コマンド | 説明 |
|---|---|
| `pnpm dev` | 開発サーバー起動 (http://localhost:3000) |
| `pnpm build` | 本番ビルド |
| `pnpm start` | 本番起動（要ビルド済み） |
| `pnpm lint` | ESLint 実行 |
| `pnpm lint:fix` | ESLint 自動修正 |
| `pnpm format` | Prettier 整形 |
| `pnpm format:check` | Prettier 確認のみ |
| `pnpm type-check` | TypeScript 型チェック |
| `pnpm gen:types` | Supabase からTypeScript型生成 |
| `pnpm db:reset` | DB リセット + マイグレーション + seed |
| `pnpm db:push` | リモート DB へマイグレーション反映 |
| `pnpm db:diff` | スキーマ差分から新規マイグレーション生成 |
| `pnpm test` | 単体テスト (Vitest) |
| `pnpm test:e2e` | E2E テスト (Playwright) |

## セキュリティ・運用ポリシー

### 必ず守ること
- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用。クライアントから import 禁止（ESLint `no-restricted-imports`）。
- 全テーブルに RLS 有効化。API でも `getCurrentUser()` で再検証する（多層防御）。
- `console.log` は禁止。代わりに `@/lib/logger` を使う（個人情報を自動マスク）。
- Stripe / LINE Webhook は署名検証 + 冪等性。
- OAuth refresh_token は `@/lib/encryption` (AES-GCM) で暗号化して保存。
- 二重予約は `reservations` の EXCLUDE 制約 + RPC transaction で防止。
- Stripe 決済の確定はフロント戻り URL で行わず、必ず Webhook を正とする。
- 招待 / Push 購読 / Cron は HMAC または `CRON_SECRET` Bearer で認証。

### コミット規約
- ブランチ: `feat/*` `fix/*` `refactor/*` `docs/*` `test/*` `chore/*`
- 1機能 1PR。DB マイグレーション含む PR は特に厳密にレビュー。
- main への直接 push 禁止。Vercel Preview Deploy で受入確認後 merge。

## デプロイ

- **Preview**: PR ごとに自動デプロイ
- **Production**: main merge で自動デプロイ
- DB マイグレーションは Vercel デプロイ前に `supabase db push` で本番反映する（運用文書参照）
- 詳細は `docs/運用_本番デプロイ.md` / `docs/運用_ロールバック.md` / `docs/運用_バックアップ.md` を参照

## QA 反映サマリ (Q001–Q025)

| QA | 内容 | 反映フェーズ |
|---|---|---|
| Q001 | ペアレッスンを MVP に含める | P1 / P6 (`reservation_pair_links`) |
| Q002 | 講師の社員/業務委託フラグ | P1 / P4 (`instructors.employment_type`) |
| Q003 | 体験予約は子供 1 名 1 回。重複時は admin 承認 | P8 (`fn_register_trial_pending`) |
| Q004 | プロフィール画像は Supabase Storage | P4 |
| Q005 | 講師の対応カテゴリは複数選択 | P4 |
| Q006 | 顧客の優先講師指定 | P5 / P6 |
| Q007 | 講師のオンライン/対面切替 | P4 |
| Q008 | 顧客住所は AES-GCM 暗号化 | P5 / `lib/encryption` |
| Q009 | 交通費は km×2 切上げ × 30 円 | P11 (`calcCarFare`) |
| Q010 | 講師の交通手段カラム | P4 / P11 |
| Q011 | レッスン時間は 30 分単位 | P6 |
| Q012 | 営業時間制約 (10:00–22:00) | P6 |
| Q013 | キャンセル 1 時間前まで無料 | P9 (`cancel-policy`) |
| Q014 | キャンセル理由別通知テンプレート | P9 / P13 |
| Q015 | メッセージ admin 監査 | P10 |
| Q016 | 通知 3 チャネル (email + LINE + Push) | P13 |
| Q017 | 講師ランク制 (Gold/Silver/Bronze/Regular) | P1 / P4 |
| Q018 | チケット制 (10回券など) | P7 |
| Q019 | Stripe Connect Express | P12 |
| Q020 | Stripe 実手数料は balance_transaction | P7 / `fn_apply_payment_fee` |
| Q021 | 体験予約の admin 承認画面 | P8 / A014 |
| Q022 | チケット期限 N 日前通知 (30/14/7/1) | P13 |
| Q023 | 講師ランク指名料 (1500/1000/500/0) | P6 |
| Q024 | 兄弟姉妹でチケット共有 (家族合算) | P5 / `fetchCustomerDashboard` |
| Q025 | 障害一次対応は KUGEDOU 山谷氏 | `docs/運用_本番デプロイ.md` |

## リリース前チェックリスト (10_チェックリスト 準拠)

### コード品質
- [ ] `pnpm lint` で警告ゼロ
- [ ] `pnpm type-check` パス
- [ ] `pnpm test` 全 7 スイートパス
- [ ] `pnpm test:e2e` TC001–TC025 パス
- [ ] `console.log` の存在ゼロ (`@/lib/logger` のみ)

### セキュリティ
- [ ] 全テーブル RLS 有効化を Supabase Dashboard で目視確認
- [ ] `docs/test/rls-tests.sql` の 8 シナリオが期待結果と一致
- [ ] `SUPABASE_SERVICE_ROLE_KEY` の使用箇所が `src/lib/supabase/admin.ts` のみ
- [ ] OAuth refresh_token が AES-GCM 暗号化されている
- [ ] Webhook 署名検証が全 Webhook (Stripe / Stripe Connect / LINE) で動作

### DB / マイグレーション
- [ ] 全 19 マイグレーションが連番で adoption 済み
- [ ] seed.sql の admin が本番では削除されている
- [ ] EXCLUDE 制約による二重予約防止が動作 (rls-tests.sql 参照)
- [ ] customer_tickets.remaining_count CHECK >= 0 が動作

### 決済 / 通知
- [ ] Stripe Webhook エンドポイントが本番 URL に登録済み
- [ ] Stripe Connect Webhook が別エンドポイントで登録済み
- [ ] LINE Messaging API の `LINE_CHANNEL_ACCESS_TOKEN` が長期トークン
- [ ] Resend ドメイン認証 (SPF/DKIM/DMARC) 完了
- [ ] VAPID 鍵が本番用に生成済み (dev 鍵を流用していない)
- [ ] Vercel Cron 4 ジョブが Dashboard に登録済み

### 認証 / 外部連携
- [ ] Google OAuth リダイレクト URI が本番ドメインで登録済み
- [ ] LINE Login Callback URL が本番ドメインで登録済み
- [ ] Google Calendar API / Routes API / Maps JS API が有効化済み

### 運用
- [ ] `docs/運用_本番デプロイ.md` の初回セットアップ完了
- [ ] バックアップ手順 (`docs/運用_バックアップ.md`) が PITR + 週次 pg_dump で稼働
- [ ] ロールバック手順 (`docs/運用_ロールバック.md`) が動作する pre-prod で確認済み
- [ ] Slack #kizashi-alerts チャネルに監視通知が届く
- [ ] 一次対応 (KUGEDOU 山谷氏) の連絡先共有完了

## ドキュメント

- `docs/00_実装方針_QA反映版.md` — QA 回答反映後の最終実装方針
- `docs/Phase{0..14}_完了報告.md` — 各フェーズ完了報告
- `docs/運用_本番デプロイ.md` / `docs/運用_バックアップ.md` / `docs/運用_ロールバック.md` — 運用手順
- `docs/test/rls-tests.sql` — RLS 逆引きテスト (psql 実行可)
- `tests/e2e/README.md` — TC001–TC025 マッピング
- 設計書本体: `Kizashi 予約管理システム 要件定義 設計書.xlsx`（13 シート）

## 障害連絡

- 一次対応: KUGEDOU 代表 山谷氏（QA Q025）
- 24/7 監視チャネル: Slack `#kizashi-alerts`

## ライセンス

Proprietary - All rights reserved.
