# Phase 6 完了報告 - 通常予約

実装日: 2026-05-09
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 SQL Migration: 予約作成 RPC
`supabase/migrations/20260509000001_create_reservation_rpc.sql`

`fn_create_normal_reservation` PL/pgSQL 関数を新規追加。
1 transaction で以下を実行:
1. `customer_tickets` を `FOR UPDATE` で行ロック
2. 所有者・残数・期限・状態を検証（業務エラーは `errcode='P0001'`）
3. 講師の `rank` から `system_settings.instructor_designation_fees` を引いて指名料を計算 (Q023)
4. `reservations` INSERT (status='confirmed')
   - **EXCLUDE 制約**により同一講師の重複時間帯は `23P01` で自動的に失敗 (PERF002 / TC013)
5. チケットの `remaining_count` を 1 減算、0 になったら `status='used'` に状態遷移
6. `audit_logs` に `reservation.created` を記録
7. `reservation_id / designation_fee / ticket_status / remaining_count` を返却

加えて `fn_attach_calendar_event` を追加：Calendar イベント作成後に `google_event_id` と `google_meet_url` を予約に紐付ける。

### 1.2 予約 Validators (`lib/validators/reservation.ts`)
- `CreateNormalReservationSchema` — Zod 厳密スキーマ
- `PairParticipantSchema` — `type='child'`（child_id 参照）または `type='free_text'`（フリーテキスト）の Union (Q001)
- `superRefine`:
  - `delivery_type='onsite'` のとき `location.address_line` を必須化
  - `end_at > start_at` を強制

### 1.3 予約作成ロジック (`lib/reservations/create.ts`)
`createNormalReservation(customerId, customerProfileId, input)`:
1. RPC `fn_create_normal_reservation` を呼ぶ
2. RPC エラーを `CreateReservationErrorCode` にマップ:
   - `23P01` → `time_conflict`
   - `ticket_*` / `instructor_*` → 対応コード
3. 対面なら `addresses` を作成して `reservations.location_address_id` を後付け bind
4. **Google Calendar イベント作成** + **Meet URL 自動発行 (Q006)** → `fn_attach_calendar_event`
5. 通知ログを `email_notification_logs` に `queued` で記録（Phase 13 で実送信）

Calendar 連携失敗時は予約自体は確定済みのため warn ログのみ（顧客フローは継続）。

### 1.4 予約 Server Action / API
- `lib/customer/reservation-actions.ts` — `createNormalReservationAction` Server Action
- `app/api/customer/reservations/route.ts`:
  - `POST` (API016) — `createNormalReservation` を呼ぶ
  - `GET` — 自分の予約一覧取得（ページネーション）
- `app/api/customer/instructors/[id]/slots/route.ts` (API015) — Phase 4 の `fetchAvailableSlots` を公開

### 1.5 C005 通常予約登録画面
`ReservationForm` Client Component で実装:
1. **講師カード**（指名料表示）
2. **お子様選択**（ラジオボタン）
3. **チケット選択**（保有 active かつ 残数 >0 かつ未失効 かつ 講師カテゴリに合うもの）
4. **カテゴリ + 形式**（オンライン/対面）
5. **対面の場合は場所入力**（郵便番号〜建物名）
6. **ペア参加者**（チケットが `lesson_format='pair'` の時のみ表示、子供複数選択＋フリーテキスト Q001）
7. **空き枠選択** — `/api/customer/instructors/:id/slots` を fetch、週単位 ±7日ナビ、日付ごとに時刻ボタン
8. **金額内訳カード**（チケット消化 + 指名料、交通費は Phase 11 で追加）
9. **sticky 下部「予約を確定する」ボタン**

Server Action 直 import で実行（Next.js 14 のパターン）。

### 1.6 C007 サンキュー画面
`/mypage/reservations/thanks?id=xxx`
- 大きな緑チェックマーク + 「予約が確定しました」
- 予約内容サマリー（お子様 / 講師 / 日時 / カテゴリ / 形式 / Meet URL）
- 次アクション: 予約詳細 / マイページ
- **Q013 キャンセル規定の注意**を末尾に表示

### 1.7 C009 予約一覧
- Tabs で「今後 / 過去」を切替
- カード形式で日時・カテゴリ・形式・体験バッジ・状態バッジを表示
- カードクリックで `/mypage/reservations/[id]` へ遷移

### 1.8 C010 予約詳細
- 予約情報カード（日時・講師・お子様・カテゴリ・形式・Meet URL）
- **対面時のみ実施場所カード**を表示
- ペア参加者があれば一覧表示
- 金額・チケットカード（消化チケット名・残数・指名料）
- **変更・キャンセルカード**:
  - `cancel_policies.free_cancel_minutes_before_start` を読み出し
  - 開始時刻まで残り分数を計算
  - 「無料キャンセル」「チケット消化キャンセル」「変更不可」を動的に切替
  - Phase 9 で本実装される予告

## 2. 変更したファイル一覧

### 新規 (10)
**SQL Migration (1)**
- `supabase/migrations/20260509000001_create_reservation_rpc.sql`

**lib (4)**
- `src/lib/validators/reservation.ts`
- `src/lib/reservations/create.ts`
- `src/lib/customer/reservation-actions.ts`

**components (1)**
- `src/components/customer/reservation-form.tsx`

**画面 (4)**
- `src/app/(customer)/mypage/reservations/new/page.tsx`
- `src/app/(customer)/mypage/reservations/thanks/page.tsx`
- `src/app/(customer)/mypage/reservations/page.tsx`
- `src/app/(customer)/mypage/reservations/[id]/page.tsx`

**API Route (2)**
- `src/app/api/customer/instructors/[id]/slots/route.ts`
- `src/app/api/customer/reservations/route.ts`

### 更新 (1)
- `src/types/database.ts` — `fn_create_normal_reservation` / `fn_attach_calendar_event` の型を追加

### 統計
- 全 TS/TSX: **117 ファイル**（Phase 5 の 107 から +10）
- 全 SQL: **14 ファイル**（Phase 1 の 13 から +1）

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| TS/TSX 厳密括弧バランス | ✅ 0件不整合 |
| `@/` alias 解決 | ✅ 0件失敗 |
| 必須ファイル存在チェック | ✅ 11/11 |
| use server / use client 違反 | ✅ 0件 |
| SQL Migration 括弧 / ドル引用 | ✅ 全件パス |

## 4. QA 反映

| QA | 反映箇所 |
|---|---|
| **Q001** | ペアレッスン時のみフォームに「ペア参加者」セクション表示。`children` から選択＋フリーテキスト両対応 |
| **Q005** | 空き枠取得 API が `system_settings` のバッファ・営業時間・予約受付窓を尊重 |
| **Q006** | オンライン予約時に `generateMeetLink=true` で Google Meet URL 自動発行 |
| **Q013** | C010 で開始時刻 1 時間前判定 + 「無料キャンセル / チケット消化キャンセル / 変更不可」の動的表示 |
| **Q023** | `fn_create_normal_reservation` で `system_settings.instructor_designation_fees` から取得して `reservations.designation_fee` に保存。フォームでも金額内訳表示 |
| **Q024** | チケット選択は customer_id 単位（家族共有） |

## 5. セキュリティ・整合性機構

### 5.1 二重予約防止（多重防御）
1. **DB**: `reservations` の EXCLUDE 制約 `(instructor_id, tstzrange(start_at,end_at)) WITH &&`
2. **RPC**: `fn_create_normal_reservation` がトランザクション内で EXCLUDE 違反を `23P01` として propagate
3. **UI**: 空き枠 API でフィルタ済み（Calendar + 既存予約 + バッファ）

### 5.2 チケット消化の原子性
- 行ロック (`FOR UPDATE`) で同時消化を防止
- `customer_tickets.remaining_count` の CHECK 制約 `>= 0` で負数化を物理的に拒否
- 残数 0 で `status='used'` に同 transaction で遷移

### 5.3 認可
- Server Action / API ともに `getCurrentUser() + role === 'customer'` 検証
- RPC は `security definer` だが `revoke from public` + `grant to authenticated/service_role` で限定
- customer_id は profile_id 経由で取得しているため、他人の customer_id を渡せない設計

### 5.4 Google Calendar 連携失敗の隔離
- Calendar API 失敗時も予約自体は確定（チケット消化済み）
- `google_event_id` `google_meet_url` は NULL のまま
- 講師は予約一覧で確認できるが Meet URL は手動連絡が必要 → 通知の文面で Meet URL なしを区別可能（Phase 13）

## 6. 動作確認手順

```bash
# 前提: Phase 0-5 セットアップ完了 + 講師の Calendar 連携完了
cd kizashi
supabase db reset             # 新規 RPC を適用
pnpm gen:types                # database.ts 自動生成（手書きの上書き可）
pnpm dev
```

### シナリオ
1. **顧客ログイン**: `/login` → SSO → `/mypage`
2. **予約フロー**:
   - `/mypage/instructors` → さくら先生 → 「この講師に予約する」
   - `/mypage/reservations/new?instructorId=xxx`
   - お子様選択（seed の「顧客花子」）
   - チケット選択（seed の 60分1回券）
   - カテゴリ「学習」/ 形式「オンライン」
   - 空き枠選択（講師の Calendar 空き + 既存予約除外）
   - 「予約を確定する」
   - `/mypage/reservations/thanks?id=xxx` に遷移
   - **DB 確認**:
     - `reservations` に1件 INSERT、`status='confirmed'`、`designation_fee=1000`（Silver）
     - `customer_tickets.remaining_count` が 1 減
     - `audit_logs` に `reservation.created` 記録
     - Calendar 連携済みなら `google_event_id` `google_meet_url` 保存
3. **競合テスト**:
   - 同じ時間帯で別ブラウザから2件目の予約 → `?error=time_conflict` で日本語エラー表示
4. **チケット枯渇テスト**:
   - 残数1のチケットを2件連続で予約 → 2件目で `?error=ticket_remaining_zero`
5. **一覧/詳細**:
   - `/mypage/reservations` で今後/過去タブ切替
   - 詳細で「無料キャンセル可」を表示（開始1h前以上）

## 7. 未実装の内容（Phase 7 以降）

- **チケット購入** (`/mypage/tickets`): Phase 7（Stripe Checkout）
- **チケット不足時の Stripe へのリダイレクト**: Phase 7
- **体験予約 (C008)**: Phase 8 — `instructor_id` なし、自動割当
- **予約変更 (C011) / キャンセル**: Phase 9 — ポリシー判定、チケット返却、Calendar event 更新/削除
- **チケットフィルタの厳密化**: 現状はカテゴリのみ。Phase 7 で Stripe 価格との同期も
- **通知の実送信**: Phase 13 (Resend / LINE / Web Push)

## 8. リスク・注意事項

### 8.1 RPC の return type ハンドリング
- `Returns: TABLE(...)` を Supabase JS Client が array で返すか単一行で返すかは PostgREST のバージョン依存
- `Array.isArray(rpcData) ? rpcData[0] : rpcData` で両対応している

### 8.2 addresses の動的 FK 検証
- `fn_validate_address_owner` トリガーは `reservation_location` の場合 `reservations` テーブルから検索する
- そのため reservation 作成後に address を作成する順序が必須

### 8.3 ペア参加者の重複
- 「メインのお子様」と「ペア参加者」に同じ child_id を含めないようフロント側で除外
- バックエンド側のチェックは現状なし（Phase 14 で追加検討）

### 8.4 Calendar API エラーの可視化
- 現状は `logger.warn` で記録するのみ
- Phase 13 で `admin_error_alert` 通知として管理者にPush通知することを検討

## 9. 次のフェーズ（Phase 7: Stripe 決済）

Phase 7 で実装:
1. **チケット購入画面 (C006)**: `/mypage/tickets` でチケット一覧 → 「購入する」→ Stripe Checkout
2. **POST /api/stripe/checkout** (API020): Checkout Session 作成（customer_id, ticket_id を metadata に格納）
3. **POST /api/stripe/webhook** (API021):
   - 署名検証
   - `stripe_webhook_events` で冪等性管理
   - `checkout.session.completed` → payments + customer_tickets 作成
   - `balance_transaction` から実 Stripe 手数料取得（Q010）
4. **予約フローからチケット購入導線**: チケット残数 0 のときフォームで CTA 表示
5. **C006 チケット購入完了画面 + 自動的に予約フロー復帰**

Phase 7 を進めますか？「Phase 7 進めて」とお伝えください。
