# Phase 2 完了報告 - 認証 / ロール制御

実装日: 2026-05-08
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 Supabase クライアント 4種完成

- `src/lib/supabase/client.ts` — Browser Component 用
- `src/lib/supabase/server.ts` — Server Component / Route Handler / Server Action 用
- `src/lib/supabase/admin.ts` — Service Role Key 使用、サーバー専用（クライアント import 禁止）
- `src/lib/supabase/middleware.ts` — middleware.ts 専用、Cookie 同期 + getUser

### 1.2 ロール別ルーティングガード（middleware.ts）

- 全パスで Cookie 同期 + 認証チェック
- `/admin` → admin、`/instructor` → instructor、`/mypage` → customer
- 未ログイン → 該当ロール用ログイン画面（`redirect_to` 付き）
- 別ロール → そのロールの既定画面へ redirect
- 講師 status='invited' → `/instructor/accept-invite` へ強制誘導
- status='suspended'/'deleted' → ログイン画面へ
- Webhook（`/api/stripe/webhook`、`/api/line/webhook`）と Cron は middleware バイパス

### 1.3 認証ヘルパー（src/lib/auth/index.ts）

- `getCurrentUser()`: 認証 + プロフィール取得
- `requireRole(role | role[])`: 権限不足時に redirect
- `redirectIfAuthenticated()`: ログイン画面で既ログインならロール別画面へ
- 各ロール画面のレイアウトで `requireRole()` を呼び、middleware と二重で防御

### 1.4 顧客 SSO ログイン（F001）

**Google SSO**

- `signInWithGoogleAction` Server Action で `supabase.auth.signInWithOAuth({ provider: 'google' })`
- callback: `/api/auth/callback?code=...&redirect_to=...`
- `exchangeCodeForSession` でセッション化 → ロール検証 → 適切な画面へ redirect

**LINE Login**（独自 OAuth：Supabase Auth 未対応のため）

- `/api/auth/line/start` — state / nonce を HttpOnly cookie に保存し LINE 認可 URL へ
- `/api/auth/line/callback`:
  1. state 検証（CSRF対策）
  2. `code` を access_token / id_token に交換
  3. id_token を LINE Verify API で検証 → sub 取得
  4. Supabase Auth Admin で対応ユーザー検索（`user_metadata.line_user_id`）
  5. 無ければ `admin.auth.admin.createUser()` で新規作成（trigger fn_handle_new_user が customers 自動作成）
  6. `admin.auth.admin.generateLink({ type: 'magiclink' })` でセッション化用 URL 取得
  7. `customers.line_user_id` 更新
  8. magic link URL に redirect → `/api/auth/callback` 経由でセッション化

### 1.5 講師招待フロー（F002）

**招待トークン（HMAC + 期限付き）**

- `src/lib/auth/invite-token.ts`
- AES-GCM 暗号化と同じ ENCRYPTION_KEY を流用、HMAC-SHA256 で署名
- フォーマット: `base64url(JSON({iid, exp, v: 'v1'}))` + `.` + `base64url(hmac)`
- timing-safe な署名比較（`crypto.timingSafeEqual`）
- 既定 TTL: `system_settings.invite_token_ttl_hours` (default 72h)

**招待メール送信（POST /api/admin/instructors/:id/invite）**

- 認可: admin のみ
- トークン発行 → `email_notification_logs` に queued ステータスで記録（実送信は Phase 13）
- `audit_logs` に `instructor.invite_sent` として記録

**招待受け入れ（POST /api/instructor/accept-invite）**

- トークン検証 → 講師レコード取得
- `auth.admin.updateUserById()` でパスワード設定 + `email_confirm: true`
- `profiles.status` / `instructors.status` を `active` に
- 自動ログイン用の magic link を発行
- `audit_logs` に `instructor.accept_invite` として記録

**招待受け入れ画面**（`/instructor/accept-invite`）

- Server Component で token を verifyInviteToken 検証
- Client Component の `AcceptInviteForm` でパスワード設定フォーム
- 送信後、magic link で自動ログイン → `/instructor` へ

### 1.6 ログイン画面 3 種

| URL                         | ロール | 認証方式                              |
| --------------------------- | ------ | ------------------------------------- |
| `/login`                    | 顧客   | Google / LINE SSO                     |
| `/admin/login`              | 管理者 | email + password (signInWithPassword) |
| `/instructor/login`         | 講師   | email + password (信用済み講師のみ)   |
| `/instructor/accept-invite` | 講師   | 招待トークン + パスワード設定         |

各画面は `redirectIfAuthenticated()` で既ログイン時にロール別画面へ自動遷移。
`?error=xxx` クエリで日本語エラーメッセージ表示。

### 1.7 ログアウト実装

- `signOutAction(role)` Server Action
- 各ロール画面のヘッダーから `<SignOutButton role="...">` で呼び出し
- `supabase.auth.signOut()` + `revalidatePath('/', 'layout')` でキャッシュ無効化
- ロール別ログイン画面へ redirect

### 1.8 各ロール画面のレイアウト強化

- `requireRole()` で defense in depth
- ヘッダーに displayName + ログアウトボタン

### 1.9 shadcn/ui 最小セット

- `Button`（5 variant + 3 size）
- `Card` + `CardHeader/CardTitle/CardDescription/CardContent/CardFooter`
- `Input`
- `Label`（Radix UI ベース）

## 2. 変更したファイル一覧（27 ファイル新規 + 3 ファイル更新）

### 新規（27）

**lib（5）**

- `src/lib/auth/actions.ts` — Google SSO / 管理者ログイン / signOut Server Actions
- `src/lib/auth/instructor-actions.ts` — 講師ログイン Server Action
- `src/lib/auth/invite-token.ts` — HMAC 招待トークン
- `src/lib/line/auth.ts` — LINE Login OAuth ユーティリティ
- `src/lib/supabase/middleware.ts` — middleware 用 Supabase クライアント

**Route Handler（5）**

- `src/app/api/auth/callback/route.ts` — Google SSO callback
- `src/app/api/auth/line/start/route.ts` — LINE Login 開始
- `src/app/api/auth/line/callback/route.ts` — LINE Login callback
- `src/app/api/admin/instructors/[id]/invite/route.ts` — 招待メール送信
- `src/app/api/instructor/accept-invite/route.ts` — 招待受け入れ

**ログイン画面（5）**

- `src/app/(auth)/admin/login/page.tsx` — 管理者ログイン
- `src/app/(auth)/instructor/login/page.tsx` — 講師ログイン
- `src/app/(auth)/instructor/accept-invite/page.tsx` — 招待受け入れ画面
- `src/app/(auth)/instructor/accept-invite/accept-invite-form.tsx` — 招待受け入れフォーム (Client)
- `src/app/(auth)/admin-login/page.tsx` — 旧 URL からの redirect

**UI コンポーネント（5）**

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/layout/sign-out-button.tsx`

### 更新（3）

- `src/middleware.ts` — Phase 0 プレースホルダー → ロール別ガード本実装
- `src/lib/auth/index.ts` — Phase 0 プレースホルダー → 本実装
- `src/app/(auth)/login/page.tsx` — Phase 0 プレースホルダー → 本実装
- `src/app/(admin)/layout.tsx` / `(instructor)/layout.tsx` / `(customer)/layout.tsx` — requireRole + ヘッダー強化

## 3. 検証結果

| 項目                              | 結果                                                   |
| --------------------------------- | ------------------------------------------------------ |
| TS/TSX 括弧バランス（厳密パーサ） | ✅ 全48ファイル整合（regex 内 `/\\//` の誤検出は除外） |
| `@/` alias 解決                   | ✅ 0件失敗                                             |
| use server / use client 違反      | ✅ 0件                                                 |
| page/layout/route の export 漏れ  | ✅ 0件                                                 |
| 必須ファイル存在チェック          | ✅ 25/25                                               |

実 DB / Next.js dev サーバーが当環境で起動不可のため、ランタイム検証は次の手順で実機確認推奨。

## 4. 動作確認手順

```bash
cd kizashi
pnpm install                                # 初回のみ
cp .env.example .env.local                  # 値を埋める
# 必須:
#   ENCRYPTION_KEY = openssl rand -base64 32
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   LINE_CLIENT_ID / LINE_CLIENT_SECRET (本番用、開発時は dummy 可)

# Supabase ローカル + マイグレーション
supabase start
supabase db reset
pnpm gen:types

# Next.js dev サーバー
pnpm dev
```

### 動作シナリオ

#### 管理者ログイン

1. `http://localhost:3000/admin/login` にアクセス
2. seed で作成された `admin@kizashi.example.com` でログイン（パスワードは `supabase auth users` でセット）
3. `/admin` ダッシュボードへ遷移
4. 別タブで `/instructor` にアクセス → admin 既定の `/admin` へリダイレクト
5. 別タブで `/mypage` にアクセス → admin 既定の `/admin` へリダイレクト

#### 顧客 Google SSO

1. `http://localhost:3000/login` で `Google でログイン` クリック
2. Google 認証画面（Supabase config の OAuth が必要）
3. callback 後、`/mypage` へ遷移
4. `/admin` にアクセス → `/mypage` へリダイレクト

#### 講師招待 → 受け入れ

1. 管理者で /admin から `POST /api/admin/instructors/:id/invite` を curl 実行
2. レスポンスの `accept_url_preview` をブラウザで開く
3. パスワード設定 → 自動ログイン → `/instructor` へ遷移

#### ログアウト

1. 各ロール画面のヘッダー「ログアウト」を押下
2. ロール別ログイン画面へ redirect

## 5. 未実装の内容（Phase 3 以降で実装）

- 管理者ダッシュボードのデータ表示（Phase 3）
- 講師管理 CRUD（Phase 3）
- チケット管理（Phase 3）
- キャンセルポリシー編集 UI（Phase 3）
- 顧客プロフィール編集 / 子供登録（Phase 5）
- メールの実送信（Phase 13、Resend 連携）
- LINE 通知の実送信（Phase 13）
- 管理者初期作成スクリプト（CLI）

## 6. リスク・注意事項

### 6.1 Supabase Auth の Google プロバイダー設定

- `supabase/config.toml` に Google OAuth を有効化する記述あり
- リモート（本番）では Supabase Dashboard → Authentication → Providers から個別設定

### 6.2 LINE Login の独自実装

- Supabase Auth 公式の LINE プロバイダーが無いため、本実装はカスタム
- magic link 経由でセッション化する都合上、メール送信なしの "Email Confirm Required" 設定不可
- → `email_confirm: true` で自動確認状態にしている

### 6.3 admin.auth.admin.listUsers の性能

- LINE callback で `listUsers({ perPage: 1000 })` を使っている
- ユーザー数が増えたら `customers.line_user_id` で profile_id を引いて後で auth.admin.getUserById に切り替える

### 6.4 招待トークンの有効期限

- system_settings.invite_token_ttl_hours で管理（default 72h）
- 期限切れ時は管理者画面から再送（POST /api/admin/instructors/:id/invite を再呼び出し）で別トークン発行

### 6.5 middleware の matcher

- `/api/stripe/webhook` `/api/line/webhook` `/api/cron` は除外
- 静的アセット（\_next/static, \_next/image, 画像ファイル）も除外
- 必要に応じて Phase 7/13 で追加調整

## 7. 次のフェーズ（Phase 3: 管理者マスタ）

Phase 3 では以下を実装:

1. 管理者ダッシュボード A002（KPI: 講師人数 / 顧客数 / チケット売上 / 予約数）
2. 講師管理 CRUD A007〜A010 + 招待メール送信ボタン
3. チケット管理 CRUD A011〜A013 + Stripe Product/Price 連携の選択
4. キャンセルポリシー管理 A014
5. 管理者一覧画面（DataTable: TanStack Table）
6. shadcn/ui 追加（Table、Dialog、Select、Form、Toast）
