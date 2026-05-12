# Phase 8 完了報告 - 体験予約

実装日: 2026-05-11
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 SQL Migration: 体験予約 RPC
`supabase/migrations/20260511000001_trial_reservation_rpcs.sql`

- **`fn_create_trial_reservation`**: 自動割当済みの講師・時間で体験予約を確定
  - 子供を `FOR UPDATE` で行ロック → `trial_used` チェック
  - 講師の rank から指名料計算 (Q023)
  - `reservation_type='trial'` で INSERT、`customer_ticket_id` は NULL（**チケット消化なし**）
  - `children.trial_used=true` に更新
  - `audit_logs` に `reservation.trial_created` を記録
- **`fn_register_trial_pending`**: Q003 重複検知時に管理者承認待ちで登録
  - `trial_pending_reviews` に INSERT
  - `audit_logs` 記録

### 1.2 自動割当アルゴリズム (`lib/reservations/auto-assign.ts`)

**設計書 Q004 準拠の 4段階スコアリング**:
1. 対応カテゴリで講師をフィルタ（必須）
2. 空き枠取得（Phase 4 の `fetchAvailableSlots`）
3. 稼働均等: 過去 30 日の `confirmed/changed/completed` 件数が**少ない**講師を優先
4. 同点時は `priority` 大 → ニックネーム昇順で安定ソート

`preferredStartIsoList` が指定されていればその時刻の枠を優先採用。空なら最も早い空き枠を採用。

### 1.3 体験予約作成ロジック (`lib/reservations/create-trial.ts`)

1. 子供取得 + `trial_used` チェック
2. **Q003 重複判定**: `fn_find_trial_duplicates` で名前+カナ+生年月日完全一致を検索
   - 「他人の子供で `trial_used=true`」が見つかれば `fn_register_trial_pending` → `pending_review` で戻る
   - そうでなければ次へ
3. 自動割当（`autoAssignInstructorForTrial`）
4. 候補なし → `no_available_instructor`
5. `fn_create_trial_reservation` RPC
6. Google Calendar event 作成 + Meet URL（Q006）
7. 通知ログ作成（メール）

戻り値 Union 型:
- `{ ok:true, status:'confirmed', reservationId, instructorId, startAt, endAt, meetUrl }`
- `{ ok:true, status:'pending_review', reviewId, matchedChildId }`
- `{ ok:false, errorCode: ... }`

### 1.4 体験予約 API + Server Action (API017)
- `POST /api/customer/trial-reservations` — JSON Body
- `createTrialReservationAction` Server Action
- 結果に応じて適切な画面へ redirect:
  - 確定 → `/mypage/reservations/thanks?id=xxx`
  - 確認待ち → `/mypage/trial-reservation/pending?review_id=xxx`
  - エラー → `/mypage/trial-reservation?error=xxx`

### 1.5 C008 体験予約画面
- 「お子様 1 人につき 1 回まで無料」の説明（Q002）
- 体験未利用の子供のみ選択可（`trial_used=false`）
- ジャンル 3 種から選択（learning/sports/art）
- レッスン時間 60/90 分、形式 オンライン/対面
- 希望日時範囲（開始日 + 終了日、9:00-23:00 の固定範囲を ISO に変換）
- 講師選択不可（Q004 で自動割当）
- インライン script で `from_date/to_date` → `from_iso/to_iso` 変換

### 1.6 体験予約 確認待ち画面 (`/mypage/trial-reservation/pending`)
- 黄色背景でステータス表示
- 申請日時 / ステータス / 管理者メモ
- 承認後は `resulting_reservation_id` から予約詳細へリンク

### 1.7 管理者向け体験予約承認画面 (`/admin/trial-reviews`)
- **確認待ち**セクション: 子供情報・申請者・申請内容 JSON 表示
- 管理者メモ入力 + 「承認して予約成立」「却下」ボタン
- **処理済み**セクション: 承認/却下履歴
- サイドナビに「体験確認」メニュー追加 (Sparkles アイコン)

### 1.8 承認 Server Action (`lib/admin/trial-review-actions.ts`)
- `approveTrialReviewAction`:
  - `trial_pending_reviews.status` を `approved` に
  - 保存されていた `requested_payload` を再パース
  - `createTrialReservation` 呼び出し（自動割当 + RPC）
  - 成立した予約 ID を `resulting_reservation_id` に bind
  - `audit_logs` に `trial_pending.approved`
- `rejectTrialReviewAction`:
  - `status='rejected'` に更新
  - `audit_logs` に `trial_pending.rejected`

## 2. 変更したファイル一覧

### 新規（10）
**SQL Migration (1)**
- `supabase/migrations/20260511000001_trial_reservation_rpcs.sql`

**lib (5)**
- `src/lib/reservations/auto-assign.ts`
- `src/lib/reservations/create-trial.ts`
- `src/lib/validators/trial-reservation.ts`
- `src/lib/customer/trial-actions.ts`
- `src/lib/admin/trial-review-actions.ts`

**画面 (3)**
- `src/app/(customer)/mypage/trial-reservation/page.tsx`
- `src/app/(customer)/mypage/trial-reservation/pending/page.tsx`
- `src/app/(admin)/admin/trial-reviews/page.tsx`

**API Route (1)**
- `src/app/api/customer/trial-reservations/route.ts`

### 更新（2）
- `src/types/database.ts` — 2 RPC の型追加
- `src/components/admin/sidebar-nav.tsx` — 「体験確認」メニュー追加

### 統計
- 全 TS/TSX: **133 ファイル**（Phase 7 の 124 から +9）
- 全 SQL: **17 ファイル**（+1 体験予約 RPC migration）

## 3. 検証結果

| 項目 | 結果 |
|---|---|
| TS/TSX 厳密括弧バランス | ✅ 0件不整合 |
| `@/` alias 解決 | ✅ 0件失敗 |
| 必須ファイル存在チェック | ✅ 10/10 |
| use server / use client 違反 | ✅ 0件 |
| SQL Migration 括弧 / ドル引用 | ✅ 16ファイル全件パス |

## 4. QA 反映

| QA | 反映箇所 |
|---|---|
| **Q002** | 期限不要、`children.trial_used=false` のみ体験対象。期間制限ロジックなし |
| **Q003** | `fn_find_trial_duplicates` (Phase 1 で実装済み) で完全一致検索 → `trial_pending_reviews` 登録 |
| **Q004** | 4段階スコアリング: カテゴリ → 空き枠 → 稼働均等 → priority |
| **Q006** | 体験予約も `createCalendarEvent` で Google Meet URL 自動発行 |
| **Q019** | 子供情報は氏名・カナ・生年月日のみ、画面で扱う情報も最小限 |
| **Q023** | 体験予約でも講師ランクの指名料を `reservations.designation_fee` に保存 |

## 5. 動作確認手順

```bash
cd kizashi
supabase db reset      # 新 RPC 適用
pnpm gen:types
pnpm dev
```

### シナリオ
1. **新規顧客の体験予約**:
   - `/mypage` → 「体験レッスンが利用できます」黄色バナー
   - 「体験予約する」→ `/mypage/trial-reservation`
   - お子様（trial_used=false）/ ジャンル / 60分 / オンライン / 期間
   - 「体験予約を確定する」
   - **期待**: 自動割当された講師で `reservations` 作成、`children.trial_used=true`、`/mypage/reservations/thanks?id=...` に遷移、`audit_logs` に `reservation.trial_created`

2. **重複検知（Q003）**:
   - 顧客 A の子供「山田太郎・ヤマダタロウ・2015-04-01」が体験利用済み
   - 顧客 B が同じ情報の子供を登録 → 体験予約申請
   - **期待**: `trial_pending_reviews` に登録、`/mypage/trial-reservation/pending?review_id=...` に遷移
   - 管理者 `/admin/trial-reviews` で承認 → 自動割当 + 確定

3. **空き枠なし**:
   - 対応カテゴリの講師がいない or 全員 Calendar 埋まり
   - **期待**: `?error=no_available_instructor`

## 6. 未実装の内容

- **体験予約の手動講師指定**: 設計上 Q004 で自動割当固定。管理者からの上書きは Phase 9 で
- **承認後の自動通知メール**: Phase 13 で実送信実装
- **却下時の理由を顧客に表示**: 現状は `review_note` のみ、Phase 13 で通知連携

## 7. リスク・注意事項

### 7.1 自動割当の競合
- 同時アクセスで同じ講師・時間の枠が選ばれた場合、2 つ目の RPC が EXCLUDE 制約で `23P01` → `time_conflict` エラー
- ユーザーが再試行すれば別講師・別枠で割当される

### 7.2 承認後の予約失敗
- 承認時に自動割当を再実行するため、申請から承認までの間に枠が埋まる可能性
- 失敗時は `?error=no_available_instructor` で管理者にフィードバック

### 7.3 重複判定の精度
- 現状は氏名+カナ+生年月日の完全一致（大文字小文字を `lower` で正規化）
- 「ヤマダタロウ」と「やまだたろう」の表記揺れは検知不可（運用ルールで管理）

### 7.4 体験予約の指名料
- 体験予約も指名料が発生する仕様（Q023）
- Stripe 連携は未実装。現状は `reservations.designation_fee` に保存するのみ
- Phase 12 の月次精算で集計対象

## 8. 次のフェーズ（Phase 9: 予約変更 / キャンセル）

Phase 9 で実装:
1. **予約変更 (C011, F032)** — ポリシー判定 (Q013: 1時間前まで無料)
2. **予約キャンセル (F033)** — チケット返却 (Q013): 半額返金-返金手数料 / 全額返金 / 消化扱い
3. **講師都合キャンセル (Q014)** — チケット消化なし + 顧客通知 + 代替講師確認
4. **Google Calendar event 更新/削除** — 変更時は patch、キャンセル時は delete
5. **Stripe 返金** — Q013 半額返金時に Stripe Refund API
6. **管理者の予約管理画面 (A003/A004)** — 強制変更・代替講師アサイン

Phase 9 を進めますか？「Phase 9 進めて」とお伝えください。
