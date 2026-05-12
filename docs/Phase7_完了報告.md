# Phase 7 完了報告 - Stripe 決済

実装日: 2026-05-10
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 SQL Migration: 決済 RPC + customers 拡張
`supabase/migrations/20260510000001_stripe_payment_rpcs.sql`

- `customers.stripe_customer_id` カラム追加（UNIQUE INDEX、Customer Portal/履歴連携用）
- **`fn_grant_customer_ticket`** PL/pgSQL 関数
  - 1 transaction で `payments` + `customer_tickets` を作成
  - `stripe_session_id` UNIQUE による冪等性
  - `tickets.valid_days` から `expires_at` を計算
  - `audit_logs` に `ticket.purchased` を記録
  - 戻り値: `payment_id / customer_ticket_id / already_processed`
- **`fn_apply_payment_fee`** PL/pgSQL 関数
  - `balance_transaction` から取得した実 Stripe 手数料を `payments.stripe_fee / net_amount / stripe_charge_id` に反映（Q010）

### 1.2 Stripe Checkout ロジック (`lib/stripe/checkout.ts`)
- `ensureStripeCustomer(customerId, email)`:
  - `customers.stripe_customer_id` が無ければ Stripe Customer を作成 → DB に保存（lazy create）
- `ensureStripePrice(ticketId)`:
  - `tickets.stripe_price_id` が無ければ Stripe Product + Price を作成 → DB に保存（lazy sync）
- `createCheckoutSession(input)`:
  - `mode=payment` / `locale=ja` / `allow_promotion_codes=false`
  - **metadata に `kizashi_customer_id` / `kizashi_ticket_id` / `return_to` を埋め込み**
  - `payment_intent_data.metadata` にも複製（balance_transaction 経由のフェイルセーフ）
  - 事前に `payments` 行を `pending` ステータスで INSERT（DB トレース用）

### 1.3 Stripe Webhook ハンドラ (`lib/stripe/webhook.ts` + Route)
**設計書 API021 / TC009 / TC010 準拠**

- `runtime = 'nodejs'` で生バイナリ取得（`request.text()`）
- **署名検証** (`stripe.webhooks.constructEvent`)
- **冪等性管理**: `stripe_webhook_events.event_id` UNIQUE で重複処理を防止
- ハンドリング:
  - `checkout.session.completed` → `fn_grant_customer_ticket` 呼び出し
  - `payment_intent.succeeded` → `latest_charge` + `balance_transaction` 取得 → `fn_apply_payment_fee` で実手数料反映 (Q010)
  - `charge.refunded` → `payments.status` を `refunded` または `partially_refunded` に更新
- エラー時は `stripe_webhook_events.error_message` に記録、500 で返却（Stripe 自動リトライに任せる）

### 1.4 Checkout API (API020)
`POST /api/stripe/checkout`:
- 認可: `customer` ロール必須
- Body: `{ ticket_id, return_to? }`
- 戻り値: `{ session_id, checkout_url }`

Server Action `startCheckoutAction`:
- フォームから POST → Stripe URL に直接 `redirect()`
- `return_to` を success_url に伝播 → 購入完了後に予約フォームへ戻る

### 1.5 C006 チケット購入画面 (`/mypage/tickets`)
- **保有チケット一覧**: active + remaining > 0 のもの
- **販売中チケット一覧**: 各カードに 価格 / 回数 / 有効日数 / 「購入する」ボタン
- `return_to` クエリがあれば「購入後に予約フォームに戻る」案内表示

### 1.6 Checkout 戻りページ (`/mypage/tickets/checkout-complete`)
- `?session_id=cs_xxx` + `?return_to=...` を受け取る
- `payments.status` で状態分岐:
  - `pending` → 「決済確認中…」+ 自動リフレッシュ（meta http-equiv）
  - `paid` → 緑チェック + チケット名 + 金額 + 「予約フォームへ戻る / マイページ」
  - `failed` / `refunded` → エラー表示
- フロント戻り URL だけで予約確定しない設計（webhook が正、TC009 準拠）

### 1.7 予約フォーム改修
チケット 0 のときの黄色背景の購入CTAを強化:
- 「Q024: 兄弟姉妹で残数を共有できます」の説明追加
- `return_to=/mypage/reservations/new?instructorId=xxx` を付けて購入後に予約フローへ自動復帰

## 2. 変更したファイル一覧

### 新規（8）
**SQL Migration (1)**
- `supabase/migrations/20260510000001_stripe_payment_rpcs.sql`

**lib (3)**
- `src/lib/stripe/checkout.ts`
- `src/lib/stripe/webhook.ts`
- `src/lib/customer/ticket-actions.ts`

**画面 (2)**
- `src/app/(customer)/mypage/tickets/page.tsx` (C006)
- `src/app/(customer)/mypage/tickets/checkout-complete/page.tsx`

**API Route (2)**
- `src/app/api/stripe/checkout/route.ts` (API020)
- `src/app/api/stripe/webhook/route.ts` (API021)

### 更新 (2)
- `src/types/database.ts` — `customers.stripe_customer_id` + 2 RPC の型追加
- `src/components/customer/reservation-form.tsx` — チケット0時の購入CTA強化

### 統計
- 全 TS/TSX: **124 ファイル**（Phase 6 の 117 から +7）
- 全 SQL: **15 ファイル**（変更なし、Phase 6 で追加）

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| TS/TSX 厳密括弧バランス | ✅ 0件不整合 |
| `@/` alias 解決 | ✅ 0件失敗 |
| 必須ファイル存在チェック | ✅ 8/8 |
| use server / use client 違反 | ✅ 0件 |
| SQL Migration 括弧 / ドル引用 | ✅ 15ファイル全件パス |

## 4. QA 反映

| QA | 反映箇所 |
|---|---|
| **Q010** | `payment_intent.succeeded` で `balance_transaction.fee/net` を取得して `payments.stripe_fee / net_amount` に保存 |
| **Q022** | `customer_tickets.expires_at` を `now() + ticket.valid_days` で生成。Phase 13 の Cron が `fn_sweep_expired_tickets` で状態遷移 |
| **Q023** | 指名料はチケット価格とは独立で予約時に追加（Stripe 商品としては「チケット」のみ販売） |
| **Q024** | 保有チケットは `customer_id` 単位で管理。家族全員（兄弟姉妹）で利用可能 |

## 5. セキュリティ・整合性機構

### 5.1 Webhook 二重防御
1. **署名検証**: `STRIPE_WEBHOOK_SECRET` で `constructEvent`
2. **冪等性**: `stripe_webhook_events.event_id` UNIQUE
3. **DB トランザクション**: `fn_grant_customer_ticket` が atomic

### 5.2 Service Role Key 隔離
- Webhook 内のみ admin client を使う
- middleware は `/api/stripe/webhook` を除外（Phase 2 で設定済み）
- `fn_grant_customer_ticket` / `fn_apply_payment_fee` は `revoke from public` + `grant to service_role` 限定

### 5.3 フロント戻り URL で予約確定しない設計 (TC009)
- success_url を踏んでも `payments.status='paid'` を確認するまで「決済確認中」表示
- 実体は webhook が `fn_grant_customer_ticket` を呼ぶことで確定
- ネットワーク遅延や Cancel → 戻り時の不正アクセスに耐性

### 5.4 lazy sync の Stripe 整合
- 初回購入時のみ Stripe Customer / Product / Price を作成 → DB に保存
- 2回目以降は DB の id をそのまま使う（API レート消費を抑制）
- 本番では管理者画面から手動同期する運用に切り替え可能（Phase 14 で検討）

## 6. 動作確認手順

### 6.1 前提
- Phase 0-6 セットアップ完了
- Stripe アカウント + テスト用 API キー
- Stripe CLI for local webhook testing:
  ```bash
  brew install stripe/stripe-cli/stripe
  stripe login
  stripe listen --forward-to http://localhost:3000/api/stripe/webhook
  # CLI が表示する whsec_xxx を .env.local の STRIPE_WEBHOOK_SECRET に設定
  ```

### 6.2 シナリオ
```bash
cd kizashi
supabase db reset     # 新 RPC を適用
pnpm gen:types
pnpm dev
# 別ターミナル: stripe listen --forward-to ...
```

1. **チケット購入**:
   - `/mypage/tickets` → 「60分1回券 ¥4,000」の「購入する」
   - Stripe Checkout テスト用カード `4242 4242 4242 4242` で決済
   - `/mypage/tickets/checkout-complete?session_id=...` に遷移
   - 「決済確認中…」(数秒) → 「購入が完了しました」
   - DB:
     - `payments` 1件 `status='paid'`
     - `customer_tickets` 1件 `remaining_count=1`、`expires_at=now+90日`
     - `audit_logs` に `ticket.purchased`
     - `stripe_webhook_events` に `checkout.session.completed` + `payment_intent.succeeded` が processed
     - `payments.stripe_fee` に実手数料（Q010）

2. **冪等性テスト (TC010)**:
   - `stripe events resend evt_xxx` で同じイベントを再送
   - `stripe_webhook_events` には1行のみ、`customer_tickets` の重複なし

3. **予約フロー復帰**:
   - チケット 0 の状態で `/mypage/reservations/new?instructorId=xxx`
   - 黄色 CTA「チケットを購入する」→ `return_to=...` 付き
   - 購入完了後「予約フォームへ戻る」→ 同じ予約フォームに復帰
   - チケットが新規に1件選択肢に出る

4. **失敗系**:
   - キャンセル: Stripe Checkout で「Cancel」→ `/mypage/tickets?error=cancelled`
   - 失敗テストカード `4000 0000 0000 0002`: `payments.status` は `pending` のまま、`stripe_webhook_events` に `payment_intent.payment_failed`（現実装は handler 未登録、Phase 13 で追加）

## 7. 未実装の内容（Phase 8 以降）

- **payment_intent.payment_failed** ハンドラ: Phase 13（通知連携）
- **返金フロー**: Phase 9 のキャンセル処理から起動
- **Customer Portal**: Phase 12 の精算管理と合わせて
- **Stripe Connect Express** (講師支払い): Phase 12
- **領収書 PDF**: Phase 13 候補

## 8. リスク・注意事項

### 8.1 Webhook の到達遅延
- Stripe は通常 1-5 秒で到達するが、ピーク時は遅延あり
- success_url のページが自動リフレッシュで対応
- 30秒以上 pending なら Stripe 側で再送される

### 8.2 lazy sync の競合
- 同じチケットを2人が同時に購入した場合、`ensureStripePrice` が2回呼ばれる
- 結果: 2 つの Price が作成される（無害だが、DB には先勝ち）
- 本番では管理者が事前に同期する運用推奨

### 8.3 amount の検証
- 現実装は Checkout Session の `amount_total` を信用
- 改ざん耐性を上げるなら、`fn_grant_customer_ticket` 内で `tickets.price` と一致するかチェック追加（Phase 14 で）

### 8.4 webhook 順序
- 通常 `checkout.session.completed` → `payment_intent.succeeded` の順
- 逆順だと `payment_intent.succeeded` で `payment` が見つからず無視される
- Stripe の eventual consistency に依存（charge.updated イベントで再処理する仕組みは Phase 14 で検討）

## 9. 次のフェーズ（Phase 8: 体験予約）

Phase 8 で実装:
1. **C008 体験予約画面** (`/mypage/trial-reservation`):
   - 講師選択不可（自動割当 Q004）
   - 子供選択（trial_used が false のもののみ）
   - ジャンル選択
   - 予約可能時間範囲選択（候補時刻一覧）
2. **自動割当アルゴリズム** (lib/reservations/auto-assign.ts):
   - 対応カテゴリ → 空き枠 → 稼働均等化 → priority 順
3. **重複判定** (Q003):
   - 子供の氏名+カナ+生年月日完全一致 → `trial_pending_reviews` に登録 → 管理者承認
   - 完全一致なし → 即予約成立
4. **API017** `POST /api/customer/trial-reservations`
5. **管理者向け体験予約承認画面**

Phase 8 を進めますか？「Phase 8 進めて」とお伝えください。
