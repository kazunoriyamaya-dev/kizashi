# Phase 15: マーケティング自動化システム

Kizashi 予約管理に追加した **マーケティング自動化システム** の MVP 骨組み一式。

## 目的

**生徒数の増加 (新規顧客獲得)** に最適化。既存生徒向けの内部管理ではなく、外部の見込み顧客 (保護者) を:

1. 認知 (SNS / ブログ / 広告)
2. リード化 (LP 購読フォーム)
3. ナーチャリング (ステップメール / 公式 LINE)
4. **体験予約申込** (Q003 体験予約フローへの誘導)
5. 体験完了
6. 有料化 (チケット購入)

の順で導線設計し、各段階を attribution テーブルで追跡します。

## アクセス制御

| ロール            | アクセス                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| admin             | `/admin/marketing/*` 全機能。`(admin)` layout + marketing layout の二重防御で `requireRole('admin')` |
| anon (見込み顧客) | `/lp/[slug]`, `/blog`, `/blog/[slug]`, `/r/[code]`, `/api/marketing/{subscribe,track}` のみ          |
| 講師 / 既存顧客   | 管理 UI は閲覧不可。middleware でロール不一致リダイレクト                                            |
| service_role      | cron / webhook のみ                                                                                  |

middleware の PUBLIC_PATHS にマーケ公開パスを明示 (`/lp`, `/blog`, `/r`, `/api/marketing/*`)。

## 提供範囲 (Q025 反映)

| 領域                               | 実装内容                                                                                                                                                                                       | 外部連携                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. SNS 画像 / バナー / 投稿 / 動画 | `marketing_assets` ライブラリ + `marketing_sns_posts` 予約投稿 + cron publisher (X / Meta / TikTok / YouTube)                                                                                  | `TWITTER_BEARER_TOKEN`, `META_PAGE_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID`, `TIKTOK_ACCESS_TOKEN`, `YOUTUBE_ACCESS_TOKEN` |
| 2. 公式 LINE 運用 / 自動化         | `marketing_line_segments` + `marketing_line_broadcasts` (broadcast / narrowcast) + `marketing_line_scenarios`                                                                                  | 既存 `LINE_CHANNEL_ACCESS_TOKEN` を流用                                                                                            |
| 3. ステップメール                  | `marketing_email_sequences` / `_sequence_steps` / `_subscribers` / `_enrollments` / `_sends` + cron dispatcher (Resend) + `{{name}} {{email}}` 差し込み                                        | 既存 `RESEND_API_KEY` を流用                                                                                                       |
| 4. LP 自動作成 / 配信 + 広告運用   | `marketing_landing_pages` (blocks JSON) + `/lp/[slug]` 公開ページ + cron 自動公開 / 取下げ + LP→シーケンス自動エンロール                                                                       | -                                                                                                                                  |
| 5. HP CMS ブログ自動作成 / 配信    | `marketing_blog_posts` (Markdown + HTML キャッシュ) + `/blog` 一覧 + `/blog/[slug]` 記事 + cron 予約公開 + 自前 Markdown レンダラ (XSS 対策済み)                                               | AI 生成は `ai_prompt` / `ai_model` メタを記録                                                                                      |
| 6. アフィリエイト連携              | `marketing_affiliate_programs` + `_links` (短縮 code) + `_clicks` + `_conversions` + `/r/[code]` UTM 付き 302 リダイレクト + ASP postback webhook `/api/marketing/affiliate-webhook/[network]` | `AFFILIATE_WEBHOOK_SECRET` (Bearer / `?secret=`)                                                                                   |
| 7. 広告運用 + 分析                 | `marketing_ad_campaigns` + `marketing_ad_metrics_daily` + cron `marketing-ad-sync` + 横断 `marketing_analytics_events` + `/admin/marketing/analytics` ダッシュボード                           | `META_AD_ACCESS_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `TIKTOK_ADS_ACCESS_TOKEN`                                                    |

## アーキテクチャ

```
                ┌─────────────────────────────────────────────┐
                │  /admin/marketing/*                         │
                │   ダッシュボード + 7 領域の CRUD UI          │
                └─────────────────────────────────────────────┘
                          │ Server Actions (admin only)
                          ▼
                ┌─────────────────────────────────────────────┐
                │  Supabase (RLS: admin all, anon = public)    │
                │  21 tables + 3 RPC                          │
                └─────────────────────────────────────────────┘
                          │
   ┌──────────────────────┼──────────────────────┐
   │                      │                      │
   ▼                      ▼                      ▼
┌────────┐         ┌────────────┐         ┌─────────────┐
│ cron   │         │ webhook    │         │ public      │
│ */10m  │         │ /api/      │         │ pages       │
│ /api/  │         │  marketing/│         │  /lp/[slug] │
│ cron/  │         │  affiliate │         │  /blog/[..] │
│ market.│         │  -webhook  │         │  /r/[code]  │
└────────┘         └────────────┘         └─────────────┘
```

## DB スキーマ

`supabase/migrations/20260515000001_marketing_system.sql` (1 マイグレーション、約 21 テーブル + 3 RPC)。

### enum

`marketing_asset_kind`, `marketing_post_channel`, `marketing_post_status`, `marketing_sequence_trigger`, `marketing_email_status`, `marketing_subscriber_status`, `marketing_lp_status`, `marketing_blog_status`, `marketing_line_target`, `marketing_ad_platform`, `marketing_ad_status`, `marketing_campaign_objective`

### テーブル一覧

- `marketing_campaigns` — マーケ施策の上位概念
- `marketing_assets` — 画像 / バナー / 動画 / 資料 ライブラリ
- `marketing_sns_posts` — SNS 各 ch への予約投稿
- `marketing_line_segments` / `_broadcasts` / `_scenarios` — 公式 LINE
- `marketing_email_sequences` / `_sequence_steps` / `_subscribers` / `_enrollments` / `_sends` — ステップメール
- `marketing_landing_pages` — LP 本体 (`blocks` jsonb、`trial_cta` ブロックを常時末尾に挿入)
- `marketing_blog_categories` / `_blog_posts` — ブログ CMS
- `marketing_affiliate_programs` / `_links` / `_clicks` / `_conversions` — アフィリエイト
- `marketing_ad_campaigns` / `_ad_metrics_daily` — 広告
- `marketing_analytics_events` — 汎用イベント
- `marketing_attribution` — **新規顧客獲得ファネル** (lead → trial → customer → paid、流入源を first-touch で保持)

### RLS

- 全テーブルに `admin all access` ポリシー。
- `marketing_landing_pages` / `marketing_blog_posts` は `published` のみ anon select 可。
- `marketing_affiliate_links` (is_active) は anon select 可 (`/r/[code]` 用)。
- それ以外は admin / service_role からのみアクセス。

### RPC

- `fn_record_affiliate_click(p_link_id, p_ip_hash, p_user_agent, p_referrer)` — atomic クリック記録 + counter インクリメント
- `fn_increment_landing_page_view(p_lp_id)` — LP PV カウンタ
- `fn_increment_blog_view(p_blog_id)` — ブログ PV カウンタ
- `fn_sync_marketing_attribution()` — service_role 専用。`marketing_attribution.email` ↔ `profiles.email` 結合で `profile_id` / `trial_reserved_at` / `trial_completed_at` / `first_paid_at` / `first_payment_jpy` を更新。cron バッチ `marketing-dispatch` から 10 分毎に実行。

## 新規顧客獲得 導線

```
SNS / 広告 / アフィリエイト
        │
        ▼
   ブログ / LP (公開)
        │
        ├─ 末尾に固定 [無料体験レッスンを予約する] CTA
        │     → /login?redirect_to=/mypage/trial-reservation&utm_*=...
        │
        └─ メール購読フォーム
              │  (lead capture + lead_source_kind 記録)
              ▼
        marketing_email_subscribers + marketing_attribution(lead_at)
              │
              ▼
     ステップメール (各ステップに体験予約 CTA を記載)
              │
              ▼
      [体験予約] (既存 /mypage/trial-reservation)
              │
              ▼  cron sync (fn_sync_marketing_attribution)
        marketing_attribution.trial_reserved_at / trial_completed_at
              │
              ▼
       [チケット購入] (既存 Stripe Checkout)
              │
              ▼
        marketing_attribution.first_paid_at / first_payment_jpy
```

リードは「first-touch」で流入源を保持し、(LP→Trial CVR), (Trial→Paid CVR), (流入源別 LTV) を analytics ダッシュボードで可視化します。

## エンドポイント

### Admin UI (`/admin/marketing/*`)

- `/` — ダッシュボード (KPI)
- `/campaigns` — キャンペーン CRUD
- `/assets` — アセット登録 (Supabase Storage パス + AI メタ)
- `/sns` — SNS 予約投稿
- `/line-broadcasts` — 公式 LINE ブロードキャスト
- `/sequences` — ステップメール一覧
- `/sequences/[id]` — シーケンスのステップ編集
- `/landing-pages` — LP 作成 (hero + body_html + form)
- `/blog` — Markdown ブログ作成
- `/affiliate` — プログラム + 短縮リンク発行
- `/ads` — 広告キャンペーン管理 + 30 日サマリー (CTR/CPC/CPA/ROAS)
- `/analytics` — イベント / クリック / メール集計

### 公開ページ

- `/lp/[slug]` — LP (blocks 解釈 + hero/feature/testimonial/faq/cta/form/rich_text)
- `/blog` — ブログ一覧
- `/blog/[slug]` — 記事
- `/r/[code]` — アフィリエイト UTM 付き 302 リダイレクト

### API

- `POST /api/marketing/subscribe` — LP 購読フォーム
- `POST /api/marketing/track` — 汎用イベント収集
- `POST /api/marketing/affiliate-webhook/[network]` — ASP postback (Bearer 認証)
- `GET /api/cron/marketing-dispatch` — \*/10 min (SNS / LINE / step mail / LP 公開 / ブログ公開)
- `GET /api/cron/marketing-ad-sync` — 04:00 (前日の広告メトリクスを各 platform から取得)

## cron 設定 (`vercel.json`)

```json
{ "path": "/api/cron/marketing-dispatch", "schedule": "*/10 * * * *" },
{ "path": "/api/cron/marketing-ad-sync", "schedule": "0 4 * * *" }
```

Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を自動付与する。

## 環境変数 (追加分はすべて optional)

```
# SNS
TWITTER_BEARER_TOKEN=
META_PAGE_ACCESS_TOKEN=
META_PAGE_ID=
META_IG_USER_ID=
TIKTOK_ACCESS_TOKEN=
YOUTUBE_ACCESS_TOKEN=

# 広告
META_AD_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_CUSTOMER_ID=
TIKTOK_ADS_ACCESS_TOKEN=

# アフィリエイト
AFFILIATE_WEBHOOK_SECRET=
```

LINE / Resend / Supabase は既存環境変数を流用。

## セキュリティ

- `SUPABASE_SERVICE_ROLE_KEY` は `src/lib/supabase/admin.ts` 経由のみ。マーケ機能で追加された使用箇所も全てサーバー側 (cron / webhook / Server Action) に限定。
- IP は `crypto.createHash('sha256').update(ENCRYPTION_KEY + ':' + ip)` でハッシュ化して保存 (生 IP は保存しない)。
- 公開フォームは Supabase RLS ではなく Server Action / API で zod 検証してから service role で書き込み。
- LP / ブログの本文 HTML は admin 入力のみ → `dangerouslySetInnerHTML` 許可。
- Markdown レンダラは自前実装で `<script>` 等の生 HTML を escape、`javascript:` リンクを `#` に置換。
- アフィリエイト webhook は `AFFILIATE_WEBHOOK_SECRET` を `timingSafeEqual` で検証。

## 拡張ポイント

| 機能                        | 拡張方法                                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 画像 AI 自動生成            | `src/lib/marketing/sns/publishers.ts` の各 publisher を、Anthropic Files / OpenAI Images / Canva API などで動的に画像生成して投稿するよう拡張 |
| 動画自動生成                | アセット種別 `video` に対し Runway / Sora / Pictory API の生成結果を `storage_path` / `public_url` で登録                                     |
| LP テンプレ自動生成         | `marketing_landing_pages.template_key` + `ai_prompt` から AI で blocks を生成 (Server Action 追加)                                            |
| ブログ AI 執筆              | `/admin/marketing/blog` の Markdown 入力欄に AI 生成結果を貼り付け。`ai_prompt` / `ai_model` をメタ保存                                       |
| アフィリエイト ASP 詳細連携 | `/api/marketing/affiliate-webhook/[network]` を ASP 別ハンドラに分岐 (A8 / valuecommerce / Amazon の署名検証を追加)                           |
| 広告自動最適化              | `marketing_ad_metrics_daily` を読み込んで budget 自動調整 / 入札変更を Server Action 化                                                       |

## 動作確認

```bash
# 1. マイグレーション適用
pnpm db:reset

# 2. 型再生成
pnpm gen:types

# 3. ローカル起動
pnpm dev

# 4. /admin/marketing にアクセス (admin ログイン後)

# 5. LP を作成 → /lp/[slug] を別タブで開く

# 6. cron をローカル試走
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/marketing-dispatch
```

## テスト

- `tests/unit/marketing-markdown.test.ts` — Markdown レンダラ (9 スイート)
- `tests/unit/marketing-landing-page.test.ts` — LP blocks normalizer (3 スイート)

## 既知の制限

- SNS publisher は X (text 投稿) / Instagram (1 枚画像) / Facebook のみ最小実装。TikTok / YouTube はスタブ。
- 広告メトリクス API クライアントはスキーマのみ用意。実 API 呼び出しは TODO コメント。
- LP の `blocks` 編集は admin UI で hero + body_html + form のみ。複雑な多ブロック編集は jsonb を直接編集する想定。
- LINE narrowcast の audienceGroupId 解決は実装外 (Messaging API の audience API で先に作成する必要)。
