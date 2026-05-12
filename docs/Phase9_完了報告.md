# Phase 9 完了報告 - 予約変更 / キャンセル

実装日: 2026-05-12
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 ポリシー判定ロジック (`lib/reservations/cancel-policy.ts`)
**`evaluateCancelPolicy(input)`**:
- 弊社都合 (`company`) → 期限関係なくチケット全額返却（Q014）
- 講師都合 (`instructor`) → 期限関係なくチケット消化なし（Q014）
- 生徒都合 (`customer`):
  - 開始時刻まで `free_cancel_minutes_before_start` 分以上 → 無料キャンセル
  - 期限外 → `ticket_return_rule_out_deadline` を適用（`half_refund_fee` / `no_return` / `full_return`）
- `half_refund_fee` の場合: チケット単価の半額 − 返金手数料500円 = 返金額

**`canChangeReservation(startAt, policy)`**:
- 変更可能期限 `free_change_minutes_before_start` を過ぎたら false

### 1.2 RPC SQL Migration (`20260512000001_cancel_change_rpcs.sql`)

**`fn_cancel_reservation`**:
1. 予約を `FOR UPDATE` 行ロック
2. status='cancelled' + cancel_reason + cancel_note 更新
3. `ticket_return_rule` 分岐:
   - `full_return` → `customer_tickets.remaining_count += 1`、`used → active` 復活
   - `half_refund_fee` → DB はそのまま（Stripe 側で別途 Refund）
   - `no_return` → 何もしない
4. 体験予約のキャンセル時は `children.trial_used = false` に戻す
5. `audit_logs` に `reservation.cancelled` 記録

**`fn_change_reservation`**:
1. 予約を `FOR UPDATE` 行ロック
2. 終了 > 開始 を検証
3. `start_at` / `end_at` / `duration_min` / `delivery_type` / `location_address_id` を UPDATE
4. **EXCLUDE 制約**により時間衝突は `23P01` で自動失敗
5. `reservation_changes` に `time_changed` の before/after を記録
6. `audit_logs` に `reservation.changed` 記録

### 1.3 ドメインロジック (`lib/reservations/cancel.ts` + `change.ts`)

**`cancelReservation(input)`**:
1. 予約 + チケット価格 + ポリシー取得
2. `evaluateCancelPolicy` で適用ルール決定
3. `fn_cancel_reservation` RPC 呼び出し
4. `half_refund_fee` の場合は **Stripe Refund API** (`stripe.refunds.create`) で返金実行 → `payments.refunded_amount` 更新
5. Google Calendar event 削除 (`deleteCalendarEvent`)
6. `email_notification_logs` に queued で記録

**`changeReservation(input)`**:
1. 予約取得 + 変更可否判定（admin は期限制約をバイパス）
2. `fn_change_reservation` RPC 呼び出し
3. `23P01` → `time_conflict` エラーコード
4. Google Calendar event を PATCH (`updateCalendarEvent`)
5. 通知ログ作成

### 1.4 API + Server Action
- `POST /api/customer/reservations/:id/cancel` (API019)
- `PATCH /api/customer/reservations/:id/change` (API018)
- **`cancelOwnReservationAction` / `changeOwnReservationAction`** — 顧客自身用
- **`adminCancelReservationAction` / `adminChangeReservationAction`** — 管理者用（reason 選択可、変更期限バイパス）

### 1.5 顧客側画面
**`/mypage/reservations/[id]/change` (C011)**:
- 変更可能期限を判定して期限外は警告表示
- `ReservationChangeForm` Client Component で空き枠を取得（Phase 6 と同じ slots API）
- 新しい時刻を選択 → Server Action 呼び出し

**`/mypage/reservations/[id]/cancel`** (Q013 ポリシー表示):
- `evaluateCancelPolicy` で「無料 / 半額返金 / 消化扱い」を事前表示
- 色分けされたカード（緑 / 黄 / 赤）
- 開始時刻を過ぎたら Web からのキャンセル不可
- 任意でキャンセル理由を入力

### 1.6 管理者側画面
**`/admin/reservations` (A003)**:
- フィルタ: すべて / 今後 / 過去 / キャンセル
- 列: 日時 / 顧客 / お子様 / 講師 / カテゴリ / 種別 / 形式 / 状態 / 詳細リンク

**`/admin/reservations/[id]` (A004)**:
- 予約情報の全フィールド表示
- **強制変更フォーム**: 新開始/終了の datetime-local 入力（管理者は変更期限制限を受けない）
- **強制キャンセルフォーム**:
  - reason 選択: `customer` / `company` / `instructor` (Q014 講師都合チケット消化なし)
  - Stripe Refund 実行可否のチェックボックス
  - メモ入力
- **変更履歴セクション** (`reservation_changes` の最新10件)

## 2. 変更したファイル一覧

### 新規（13）
**SQL Migration (1)**
- `supabase/migrations/20260512000001_cancel_change_rpcs.sql`

**lib (5)**
- `src/lib/reservations/cancel-policy.ts`
- `src/lib/reservations/cancel.ts`
- `src/lib/reservations/change.ts`
- `src/lib/customer/reservation-modify-actions.ts`
- `src/lib/admin/reservation-actions.ts`

**components (1)**
- `src/components/customer/reservation-change-form.tsx`

**画面 (4)**
- `src/app/(customer)/mypage/reservations/[id]/cancel/page.tsx`
- `src/app/(customer)/mypage/reservations/[id]/change/page.tsx`
- `src/app/(admin)/admin/reservations/page.tsx`
- `src/app/(admin)/admin/reservations/[id]/page.tsx`

**API Route (2)**
- `src/app/api/customer/reservations/[id]/cancel/route.ts`
- `src/app/api/customer/reservations/[id]/change/route.ts`

### 更新（1）
- `src/types/database.ts` — 2 RPC の型追加

### 統計
- 全 TS/TSX: **145 ファイル**（Phase 8 の 133 から +12）
- 全 SQL: **18 ファイル**（+1 キャンセル/変更 RPC migration）

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| TS/TSX 厳密括弧バランス | ✅ 0件不整合 |
| `@/` alias 解決 | ✅ 0件失敗 |
| 必須ファイル存在チェック | ✅ 13/13 |
| use server / use client 違反 | ✅ 0件 |
| SQL Migration 括弧 / ドル引用 | ✅ 17ファイル全件パス |

## 4. QA 反映

| QA | 反映箇所 |
|---|---|
| **Q013** | 開始 1 時間前まで無料キャンセル、期限外は `half_refund_fee` で半額 − 返金手数料500円、Stripe Refund 自動実行 |
| **Q014** | 講師都合キャンセルは `ticket_return_rule_instructor='full_return'` でチケット消化なし、顧客通知の template を `reservation_cancelled_by_instructor` に分岐 |
| **TC013** | EXCLUDE 制約により変更時の二重予約は `23P01` で自動失敗 |
| **TC018** | `reservation_changes` テーブルに before/after を記録、`audit_logs` にも記録 |
| **TC020/TC021** | キャンセル期限内/外でチケット返却ルールを切替 |
| **TC025** | 全変更操作で `audit_logs` を記録 |

## 5. セキュリティ・整合性機構

### 5.1 多重防御
1. **DB**: EXCLUDE 制約で変更時の時間重複を物理的に防止
2. **RPC**: 行ロック (FOR UPDATE) + status 検証
3. **アプリ層**: 顧客は自分の予約のみ操作可（FK 経由で検証）
4. **管理者**: 変更期限はバイパス、ただし監査ログに必ず記録

### 5.2 Stripe Refund の冪等性
- `stripe.refunds.create` は payment_intent 単位で複数呼び出し可能
- `payments.refunded_amount` を更新して同じ金額の重複返金を防止
- 実装上は 1 回のみ実行（half_refund_fee + performStripeRefund=true）

### 5.3 Calendar 連携失敗の隔離
- `deleteCalendarEvent` / `updateCalendarEvent` 失敗は warn ログのみ
- 予約自体のキャンセル/変更は DB レベルで成立
- Phase 13 で Calendar 同期再試行バッチを検討

### 5.4 体験予約のリセット
- 体験予約キャンセル → `children.trial_used = false` に自動復元
- 不正利用防止のため、管理者画面 (`/admin/trial-reviews`) で履歴確認可能

## 6. 動作確認手順

```bash
cd kizashi
supabase db reset    # 新 RPC 適用
pnpm gen:types
pnpm dev
```

### シナリオ

1. **無料キャンセル**:
   - 顧客が `/mypage/reservations/[id]/cancel` を開く
   - 開始 1 時間前以上 → 「無料でキャンセルできます」表示
   - キャンセル確定 → `customer_tickets.remaining_count` が +1、Calendar event 削除、`audit_logs` に記録

2. **半額返金キャンセル (Q013)**:
   - 開始 30 分前のキャンセル → 「半額返金 ¥1,500」表示
   - 確定 → DB はチケット消化扱い、Stripe Refund 実行、`payments.refunded_amount` 更新

3. **時間変更**:
   - `/mypage/reservations/[id]/change` で空き枠から新時刻選択
   - 確定 → `fn_change_reservation` 実行、Calendar event PATCH、`reservation_changes` 記録
   - 衝突する時刻を選ぶ → `time_conflict` エラー

4. **管理者の講師都合キャンセル (Q014)**:
   - `/admin/reservations/[id]` で reason=instructor 選択
   - 確定 → チケット返却なし、`audit_logs` に actor_role=admin で記録

5. **体験予約キャンセル**:
   - 体験予約をキャンセル → `children.trial_used=false` に戻る → 再度 `/mypage/trial-reservation` から予約可能

## 7. 未実装の内容

- **代替講師アサイン (Q014)**: 講師都合キャンセル時に「代替講師を提案する」フローは Phase 10 のメッセージ機能と連携で実装
- **キャンセル料計算の管理者プレビュー**: A014 で別途見積もり画面（Phase 14 候補）
- **Refund 失敗時の手動再試行**: 現状は warn ログのみ。管理者に通知 → 手動 Refund する運用（Phase 13）

## 8. リスク・注意事項

### 8.1 タイムゾーン
- フロントの datetime-local 入力はローカルタイムで送信される
- Server 側で `new Date(...)` で UTC に変換 → DB は timestamptz で保持
- 表示時は `toLocaleString('ja-JP')` で JST 表示

### 8.2 Refund 手数料
- Stripe の `refund` も手数料 (3.6%) がかかる
- 現実装は元金額ベースで返金。Stripe の返金手数料は Kizashi 負担
- 必要に応じて Q010 同様に `balance_transaction` で実額追跡（Phase 13 候補）

### 8.3 EXCLUDE 制約と現在予約
- `fn_change_reservation` は自分自身を除外する仕組みが必要だが、現状は時間が完全に変わる前提
- 同じ時間にそのまま再保存しても、自分自身は EXCLUDE 制約上「重複」とは判定されない（同じ ID のため）
- 微妙な時間調整（5分ずらしなど）は普通に動作

### 8.4 体験予約の trial_used リセット
- キャンセル時に `trial_used=false` に戻すが、悪用防止のため運用上は管理者の目視確認が望ましい
- `audit_logs.action='reservation.cancelled'` でフィルタすれば全件確認可能

## 9. 次のフェーズ（Phase 10: メッセージ機能）

Phase 10 で実装:
1. **メッセージ送受信 API** (API023/API024)
2. **スレッド権限制御**:
   - 顧客 ⇔ 予約済み講師
   - 顧客 ⇔ 管理者
   - 管理者は全スレッド閲覧可能
3. **C012/C013** 顧客メッセージ画面
4. **I007/I008** 講師メッセージ画面
5. **A015/A016** 管理者メッセージ画面
6. **既読管理** + **代替講師提案フロー** (Q014 から派生)

Phase 10 を進めますか？「Phase 10 進めて」とお伝えください。
