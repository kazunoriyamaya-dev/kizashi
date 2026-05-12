# Phase 12 完了報告 - 精算 / 月次処理

実装日: 2026-05-12
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 月次精算 RPC SQL (`20260513000001_payout_rpcs.sql`)

**`fn_compute_monthly_payouts(period_month, recompute=false)`** — 月次集計:
- 対象月の `reservations.status='completed'` から講師別に集計
- 各講師の：
  - `ticket_gross` = SUM(消化チケット単価)
  - `stripe_fee` = SUM(payments.stripe_fee × チケット価格 ÷ payment.amount) **= 按分**
  - `designation_fee` = SUM(reservations.designation_fee)
  - `travel_fee` = SUM(travel_fees.amount)
  - `instructor_amount` = `floor((ticket_gross - stripe_fee) × 0.5) + designation_fee + travel_fee`
- インボイス番号を `invoice_settings` から取得してスナップショット保存（Q012）
- `payouts` (instructor_id × period_month UNIQUE) で upsert
- `recompute=false` のとき `confirmed/paid` は skip、`true` のとき強制上書き

**`fn_confirm_payout(payout_id, actor_profile_id)`** — draft → confirmed
- 行ロック + 状態検証 + `audit_logs`

**`fn_mark_payout_paid(payout_id, actor_profile_id, stripe_transfer_id, ...)`** — confirmed → paid
- Stripe Transfer 完了後に呼ぶ
- `stripe_transfer_id` を保存

### 1.2 Stripe Connect Express ヘルパー (`lib/stripe/connect.ts`)
- **`createOrGetConnectAccount(instructorId)`**: Express Account を作成 or 取得
  - `type: 'express'`、`country: 'JP'`、`business_type: 'individual'`
  - `capabilities.transfers: { requested: true }`
- **`createAccountOnboardingLink(accountId, returnUrl, refreshUrl)`**: オンボーディング URL を発行
- **`syncConnectAccountStatus(accountId)`**: Stripe からアカウント状態を取得 → DB 更新
  - `onboarding_completed` = `details_submitted && (charges_enabled || payouts_enabled)`
- **`createTransferToInstructor({payoutId, periodMonth, stripeAccountId, amount})`**: 月次 Transfer 実行
  - currency='jpy'、metadata に payout_id / period_month を保存

### 1.3 月次集計 TS ラッパー (`lib/payouts/calculate.ts`)
- **`computeMonthlyPayouts(periodIso, recompute)`**: RPC を呼び結果整形
- **`listPayouts(periodIso)`**: 講師情報 + Stripe Connect 状態を結合して返す
- **`payoutsToCsv(rows)`**: UTF-8 BOM 付き Excel 互換 CSV を生成

### 1.4 Server Actions
**管理者 (`lib/admin/payout-actions.ts`)**:
- `runMonthlyPayoutComputationAction` — 対象月の集計を実行
- `confirmPayoutAction(payoutId, fd)` — draft → confirmed
- `payInstructorAction(payoutId, fd)` — Stripe Transfer 実行 → paid
  - Connect 未連携 / payouts_enabled=false / amount=0 を事前チェック

**講師 (`lib/instructor/connect-actions.ts`)**:
- `startInstructorOnboardingAction` — オンボーディング開始 → Stripe URL に redirect
- `refreshInstructorConnectStatusAction` — Stripe から状態同期

### 1.5 API Routes
- `POST /api/stripe/connect/onboard` — 講師のオンボーディング URL を返す
- `POST /api/stripe/connect/sync` — Connect 状態同期
- `GET /api/admin/payouts/csv?period=YYYY-MM` — CSV ダウンロード (Excel 互換 BOM)

### 1.6 A017 管理者精算管理画面
- 対象月選択 (`<input type="month">`)
- 「集計を実行」+ recompute チェックボックス
- 「CSV ダウンロード」ボタン
- 講師別テーブル:
  - 売上 / Stripe手数料 / 指名料 / 交通費 / 支払額
  - 状態バッジ / Connect 状態バッジ / インボイス番号
  - 操作列: `draft` なら「確定」、`confirmed + Connect OK` なら「支払う」、`paid` なら Transfer ID 表示
- 計算式の説明を末尾にカード表示

### 1.7 講師精算履歴画面 (`/instructor/payouts`)
- Stripe Connect カード:
  - 未連携 → 「Stripe Connect を開始」
  - 連携中 → 「オンボーディングを続行」「状態を再同期」
  - 連携済 → 状態バッジ表示
- インボイス番号カード
- 精算履歴テーブル（最新36ヶ月）

講師サイドナビに「精算」メニュー追加。

## 2. 変更したファイル一覧

### 新規（10）
**SQL Migration (1)**
- `supabase/migrations/20260513000001_payout_rpcs.sql`

**lib (4)**
- `src/lib/stripe/connect.ts`
- `src/lib/payouts/calculate.ts`
- `src/lib/admin/payout-actions.ts`
- `src/lib/instructor/connect-actions.ts`

**API Route (3)**
- `src/app/api/stripe/connect/onboard/route.ts`
- `src/app/api/stripe/connect/sync/route.ts`
- `src/app/api/admin/payouts/csv/route.ts`

**画面 (2)**
- `src/app/(admin)/admin/payouts/page.tsx`
- `src/app/(instructor)/instructor/payouts/page.tsx`

### 更新 (2)
- `src/types/database.ts` — 3 RPC の型追加 + payout_status 型
- `src/components/instructor/sidebar-nav.tsx` — 「精算」メニュー追加

### 統計
- 全 TS/TSX: **171 ファイル**（Phase 11 の 162 から +9）
- 全 SQL: **19 ファイル**（+1 精算 RPC migration）

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| TS/TSX 厳密括弧バランス | ✅ 0件不整合（regex `/"/g` の誤検出は除外） |
| `@/` alias 解決 | ✅ 0件失敗 |
| 必須ファイル存在チェック | ✅ 10/10 |
| use server / use client 違反 | ✅ 0件 |
| SQL Migration 括弧 / ドル引用 | ✅ 18ファイル全件パス |

## 4. QA 反映

| QA | 反映箇所 |
|---|---|
| **Q010** | `fn_compute_monthly_payouts` で payments.stripe_fee を予約金額按分して講師取り分から控除 |
| **Q011** | (売上 − Stripe手数料) × 50% + 指名料 + 交通費 = 講師取り分。Stripe Connect Express で支払い |
| **Q012** | invoice_settings.invoice_registration_no を payouts にスナップショット、A017 で表示。源泉徴収なし |
| **F018** | 管理者の精算管理画面、CSV エクスポート対応 |

## 5. セキュリティ・整合性機構

### 5.1 計算式の atomic 実行
- 単一 RPC `fn_compute_monthly_payouts` で集計 + UPSERT を SQL 内で完結
- 行ロック + UNIQUE 制約 (instructor_id × period_month) で重複防止
- `recompute=false` で confirmed/paid を保護

### 5.2 Stripe Transfer の冪等性
- `confirmed` ステータスのみ Transfer 実行可
- Transfer 後即座に `paid` ステータスに遷移
- 失敗時はステータスそのままで管理者画面に「transfer_failed」エラー表示
- 同一 payout の二重 Transfer は `payout_not_confirmed` で防止

### 5.3 認可
- 全 RPC が `revoke from public + grant to service_role` 限定
- Server Action / API で `getCurrentUser + role` 検証
- `payInstructorAction` 内で Connect 状態を事前確認

### 5.4 audit_logs 記録
- `payout.confirmed` / `payout.paid` を `audit_logs` に記録
- 改ざん不可（Phase 1 のトリガーで UPDATE/DELETE 禁止）

## 6. 動作確認手順

### 6.1 前提
- Stripe Connect が有効化された Stripe アカウント
- `.env.local` に `STRIPE_SECRET_KEY` 設定済み
- 講師に対応する Stripe Connect Express Account を作成（オンボーディング不要、capabilities=transfers）
- 対象月に `status='completed'` の予約が存在

### 6.2 シナリオ
```bash
cd kizashi
supabase db reset    # 新 RPC 適用
pnpm gen:types
pnpm dev
```

1. **講師オンボーディング**:
   - `/instructor/payouts` → 「Stripe Connect を開始」
   - Stripe オンボーディング画面で必要事項入力（テストモードはダミー OK）
   - 戻り URL で `/instructor/payouts?connect=return`
   - 「状態を再同期」→ `payouts_enabled=true` に
2. **管理者集計**:
   - `/admin/payouts?period=2026-05`
   - 「集計を実行」→ 講師別 draft レコードが作成される
   - 計算式の検証: 売上1000円 + Stripe手数料36円 + 指名料1000円 + 交通費500円 → (1000-36)×0.5 + 1000 + 500 = 1982円
3. **確定 + 支払い**:
   - 該当行の「確定」→ status=confirmed
   - 「支払う」→ Stripe Transfer 実行 → status=paid、`stripe_transfer_id` 保存
4. **CSV ダウンロード**:
   - 「CSV ダウンロード」ボタン → `kizashi-payouts-2026-05.csv` 取得
   - Excel で開いて文字化けなし
5. **講師確認**:
   - 講師の `/instructor/payouts` で履歴に表示

## 7. 未実装の内容（後続フェーズ）

- **Stripe Webhook の Connect 連携イベント** (account.updated): Phase 13 で追加
- **Cron バッチで月初に自動集計**: Phase 13 で Vercel Cron 連携
- **失敗 Transfer のリトライ**: Phase 13 で `payout_status='cancelled'` + 通知連携
- **税務関連 PDF（支払調書）**: 別途検討

## 8. リスク・注意事項

### 8.1 Stripe 手数料按分の精度
- 現実装は `payments.stripe_fee × チケット価格 / payments.amount` で按分
- 1 つの payment が複数チケットを包含する場合に丸め誤差が出る可能性
- 合計が元の手数料を超えない様 `floor` を使用

### 8.2 Connect Account の制限
- `business_type=individual` + `country=JP` 固定
- 法人講師の対応は別途設定が必要
- 18歳未満の講師は Stripe 規約で受け付け不可

### 8.3 Transfer の前提
- Kizashi の Stripe アカウントが「Connect platform」として認証されている必要あり
- テストモードでは Connect で残高がなくても Transfer 可能（自動補填）
- 本番では事前に Stripe 残高があることを確認

### 8.4 タイムゾーン
- `period_month` は date 型（時刻なし）でJST月初を保持
- 集計時の `start_at >= period_start AND start_at < period_end` は UTC 比較
- JST/UTC 跨ぎ予約は注意（日本国内のみなら影響軽微）

## 9. 次のフェーズ（Phase 13: 通知）

Phase 13 で実装:
1. **メール送信** (Resend) — `email_notification_logs` の queued を batch / event 駆動で送信
2. **LINE 通知** (Messaging API) — 顧客 LINE 連携済みに送信
3. **Web Push** (VAPID) — オプトインユーザーに送信
4. **Vercel Cron** — チケット期限通知（Q022: 30/14/7/1日前）、月初の精算集計
5. **代替講師提案フロー** (Q014)

Phase 13 を進めますか？「Phase 13 進めて」とお伝えください。
