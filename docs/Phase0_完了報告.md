# Phase 0 完了報告

実装日: 2026-05-04
担当: Claude（Cowork mode）

## 1. 実装した内容

### プロジェクト初期化（Next.js 14 / TypeScript）
- `package.json` に Next.js 14.2 / React 18.3 / Supabase / Stripe / Google APIs / LINE / web-push / Resend / shadcn/ui 関連の依存を定義
- `tsconfig.json`（strict、noUncheckedIndexedAccess、`@/*` パス、isolatedModules）
- `next.config.mjs`（セキュリティヘッダ、Image remotePatterns、Server Actions 設定）
- `tailwind.config.ts`（shadcn/ui 互換 + Kizashi 独自カラー: category 学習/スポーツ/芸術、rank gold/silver/bronze/regular）
- `postcss.config.mjs`、`components.json`（shadcn/ui 設定）

### 開発ツール設定
- ESLint（`.eslintrc.json`）：
  - `@/lib/supabase/admin` のクライアントからの import を `no-restricted-imports` で禁止
  - `console.log` を `no-restricted-syntax` で警告
  - `@typescript-eslint/no-explicit-any` を error
- Prettier（`.prettierrc.json`、`.prettierignore`）
  - `prettier-plugin-tailwindcss` でクラス名自動ソート
  - `cn` `clsx` `cva` 関数内のクラスを認識

### 環境変数テンプレート
- `.env.example` に設計書 06_環境_GitHub の14変数 + Phase別の追加変数を網羅：
  - Supabase 4変数（URL/anon/service_role/database_url）
  - Stripe 5変数（pk/sk/webhook_secret/connect_webhook_secret/connect_client_id）
  - Google 3変数（client_id/secret/maps_api_key）
  - LINE 4変数（login client_id/secret + Messaging access_token/channel_secret）
  - 通知 3変数（Resend api_key、from、reply_to）
  - Push 3変数（VAPID public/private/subject）
  - 暗号化 1変数（ENCRYPTION_KEY）
  - その他（CRON_SECRET、ADMIN_BOOTSTRAP_TOKEN、APP_URL、NODE_ENV）

### App Router ディレクトリ構造
- Route Group 分離: `(auth)` / `(admin)` / `(instructor)` / `(customer)`
- 各ロール専用 Layout（管理者・講師: PC、顧客: スマホファースト max-w-md）
- Phase 別プレースホルダー Page を配置（A002, I002, C002, C001 ログイン）
- ルート Layout（Noto Sans JP、テーマ色、robots: noindex）
- `error.tsx` / `not-found.tsx`（個人情報を露出させない固定文言）
- `middleware.ts` プレースホルダー（Phase 2 で本格実装）

### lib/ ドメインモジュールスケルトン
- `supabase/{client,server,admin}.ts` — 3種クライアント分離。admin はクライアント側 import 不可
- `env.ts` — Zod による環境変数バリデーション（Phase 0 は警告のみ、Phase 2 で必須化）
- `logger/index.ts` — PII 自動マスク（email/phone/name/address/birth_date/access_token 等）
- `encryption/index.ts` — AES-256-GCM 暗号化（OAuth トークン保存用）
- `permissions/index.ts` — Role 型 + デフォルトリダイレクト先
- `auth/index.ts` — `getCurrentUser` / `requireRole` インターフェイス
- `stripe/index.ts` — Stripe SDK インスタンス（apiVersion 固定）
- `google/calendar.ts` — Free/Busy 取得 + イベント作成のインターフェイス
- `google/maps.ts` — Routes API + 車30円/km切り上げ計算
- `line/index.ts` — LINE 通知インターフェイス
- `notifications/index.ts` — メール/LINE/Push 統合通知 + イベント定義
- `utils.ts` — `cn` / `formatJPY` / `calcCarFare`（往復・小数点切り上げ）

### 型定義
- `src/types/database.ts` — Supabase 自動生成型のプレースホルダー（Phase 1 で `pnpm gen:types`）
- `src/types/index.ts` — 共通ドメイン型 + `INSTRUCTOR_DESIGNATION_FEES`（Q023）/ `CATEGORY_LABELS` / `RANK_LABELS`

### ドキュメント
- `README.md` — セットアップ手順、ディレクトリ構成、スクリプト、セキュリティポリシー
- `docs/00_実装方針_QA反映版.md` — QA 回答（Q001 ペアレッスン、Q013 1時間前無料キャンセル、Q023 講師ランク指名料）反映済み
- `docs/Phase0_完了報告.md` — 本文書

## 2. 変更したファイル一覧（41ファイル）

### ルート（10）
- `package.json` / `tsconfig.json` / `next.config.mjs` / `tailwind.config.ts` / `postcss.config.mjs`
- `components.json` / `.eslintrc.json` / `.prettierrc.json` / `.prettierignore` / `.gitignore`
- `.env.example` / `README.md`

### App Router（11）
- `src/middleware.ts`
- `src/app/layout.tsx` / `page.tsx` / `error.tsx` / `not-found.tsx` / `globals.css`
- `src/app/(auth)/login/page.tsx`
- `src/app/(admin)/layout.tsx` / `admin/page.tsx`
- `src/app/(instructor)/layout.tsx` / `instructor/page.tsx`
- `src/app/(customer)/layout.tsx` / `mypage/page.tsx`

### lib（13）
- `src/lib/utils.ts` / `env.ts`
- `src/lib/auth/index.ts`
- `src/lib/encryption/index.ts`
- `src/lib/google/calendar.ts` / `maps.ts`
- `src/lib/line/index.ts`
- `src/lib/logger/index.ts`
- `src/lib/notifications/index.ts`
- `src/lib/permissions/index.ts`
- `src/lib/stripe/index.ts`
- `src/lib/supabase/{admin,client,server}.ts`

### types（2）
- `src/types/database.ts` / `index.ts`

### docs（2）
- `docs/00_実装方針_QA反映版.md` / `Phase0_完了報告.md`

## 3. 未実装の内容

Phase 0 の範囲外（後続フェーズで実装）：
- 認証・セッション管理（Phase 2）
- DB マイグレーション・RLS（Phase 1）
- Supabase 自動生成型（Phase 1）
- 各画面の本実装（Phase 3 以降）
- API Route Handler の本実装（各 Phase）
- shadcn/ui コンポーネント生成（必要に応じて Phase 3 以降で `pnpm dlx shadcn@latest add button` 等を実行）
- E2E テスト基盤（Phase 14）

Phase 0 のスコープ外として意図的に未実装：
- Vercel Cron 設定 (`vercel.json`) — Phase 13 で追加
- Stripe Webhook ハンドラ — Phase 7
- 講師招待トークンの HMAC 実装 — Phase 2
- VAPID キー生成スクリプト — README に手順記載済み

## 4. 次に実装すべき内容（Phase 1: DB / RLS 基盤）

Phase 1 では以下を実装する：

1. **Supabase ローカル環境立ち上げ**
   - `supabase init` で Supabase CLI 初期化
   - `supabase/config.toml`、`supabase/seed.sql` 作成

2. **27テーブルのマイグレーション SQL**
   - 設計書 04_DB_RLS設計の 16テーブル + 補完 11テーブル（Q023 で system_settings 追加し計27）
   - 命名規則・命名統一・FK 制約・チェック制約
   - `reservations` の EXCLUDE 制約（btree_gist 拡張）
   - `stripe_webhook_events.event_id` UNIQUE
   - `customer_tickets.remaining_count >= 0`

3. **RLS ポリシー**
   - 全テーブルで `ENABLE ROW LEVEL SECURITY`
   - 設計書 04_DB_RLS設計の方針通り SELECT / INSERT / UPDATE / DELETE 別に作成
   - 講師が顧客情報を取得する RPC（直接 SELECT 不可）

4. **状態遷移トリガー**
   - `customer_tickets`: 残数 0 → used、有効期限超過 → expired
   - `audit_logs` の自動書き込み関数

5. **seed データ**
   - カテゴリ・ジャンル・キャンセルポリシー初期値・指名料 system_settings

6. **型生成**
   - `supabase gen types typescript > src/types/database.ts`

## 5. 動作確認方法

### Phase 0 の動作確認

```bash
# 1. プロジェクトに移動
cd kizashi

# 2. 依存関係インストール
pnpm install

# 3. 環境変数の最小設定（Phase 0 では一部のみ必須）
cp .env.example .env.local
# .env.local を編集:
#   - APP_URL=http://localhost:3000
#   - NEXT_PUBLIC_SUPABASE_URL に何か入れる（実体は Phase 1 まで使わない）
#   - NEXT_PUBLIC_SUPABASE_ANON_KEY に何か入れる
#   - SUPABASE_SERVICE_ROLE_KEY に何か入れる
#   - ENCRYPTION_KEY を生成: openssl rand -base64 32

# 4. 開発サーバー起動
pnpm dev

# 5. ブラウザで http://localhost:3000 を開く
#    トップページに3ロールのリンク（admin/instructor/mypage）が表示される

# 6. 各リンクをクリックすると Phase 別プレースホルダーが表示される
#    /admin → 「ダッシュボード（Phase 3で実装予定）」
#    /instructor → 「予約一覧（Phase 4で実装予定）」
#    /mypage → 「マイページ（Phase 5で実装予定）」
#    /login → SSO ログインプレースホルダー

# 7. リント・型チェック
pnpm lint
pnpm type-check
pnpm format:check
```

### 確認観点
- [ ] `pnpm dev` がエラーなく起動する
- [ ] http://localhost:3000 がレンダリングされる
- [ ] 各 Route Group のレイアウトが切り替わる（管理者: グレー背景、顧客: max-w-md）
- [ ] `pnpm lint` が pass（warning は許容）
- [ ] `pnpm type-check` が pass
- [ ] `pnpm build` が pass する（要 SUPABASE_URL 等のダミー値）

## 6. リスク・注意事項

### Phase 1 への引き継ぎリスク
1. **Supabase CLI バージョン**: `package.json` で `supabase: ^2.6.8` を指定。最新版でマイグレーションシンタックスが変わる可能性。
2. **EXCLUDE 制約の拡張機能**: `btree_gist` を有効化する `CREATE EXTENSION` を Phase 1 のマイグレーション初頭に入れる必要あり。
3. **`.vscode/settings.json`**: 当環境の制約で配置できなかった。実環境で必要であればリポジトリ側で追加する。

### 設計書差分の取り扱い
QA 回答により以下が確定したことを `docs/00_実装方針_QA反映版.md` に記載：
- Q001 ペアレッスンを MVP に含める（チケット `lesson_format`、予約 `pair_participants`）
- Q013 1時間前まで無料キャンセル（`cancel_policies.free_cancel_minutes_before_start`）
- Q023 講師ランク別指名料（Gold ¥1,500 / Silver ¥1,000 / Bronze ¥500 / Regular ¥0）

これらは Phase 1 の DB 設計に直接反映する。
