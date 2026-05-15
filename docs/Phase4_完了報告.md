# Phase 4 完了報告 - 講師プロフィール / Google Calendar 連携

実装日: 2026-05-08
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 Google OAuth 2.0 ヘルパー (`lib/google/oauth.ts`)

- `buildCalendarAuthorizationUrl`: 認可 URL 生成（access_type=offline + prompt=consent で refresh_token 確実取得）
- `exchangeCodeForGoogleTokens`: code → access_token/refresh_token/id_token 交換
- `refreshGoogleAccessToken`: refresh_token で access_token を更新
- `decodeIdTokenEmail`: id_token から連携アカウントメールを抽出（署名検証は省略）
- スコープ: `calendar.events` + `calendar.readonly` + `userinfo.email`

### 1.2 Google Calendar API ラッパー (`lib/google/calendar.ts`)

- `getValidAccessToken(instructorId)`: DB から取得した access_token が期限切れなら自動 refresh + 暗号化保存
- `getFreeBusyForInstructor`: freeBusy.query で busy 期間を返す
- `createCalendarEvent`: events.insert + conferenceData で **Google Meet URL 自動発行 (Q006)**
- `updateCalendarEvent`: events.patch
- `deleteCalendarEvent`: events.delete（404/410 は成功扱い）
- 全関数で AES-GCM 暗号化された refresh_token を `decrypt()` してから使用、リフレッシュ後は `encrypt()` で再保存

### 1.3 講師 Calendar OAuth API (Route Handlers)

- `GET /api/instructor/google-calendar/auth-url` (API012):
  - state を HttpOnly cookie に保存
  - 講師の `contact_email` を `login_hint` に渡す
  - Google 認可ページへリダイレクト
- `GET /api/instructor/google-calendar/callback` (API013):
  - state 検証（CSRF 対策）
  - code を tokens 交換
  - `decodeIdTokenEmail` で連携メール取得
  - access_token / refresh_token を AES-GCM 暗号化して `calendar_connections` に upsert
  - audit_logs に `instructor.calendar_connected` 記録
- `POST /api/instructor/google-calendar/disconnect`:
  - calendar_connections 削除
  - audit_logs に `instructor.calendar_disconnected` 記録

### 1.4 空き枠取得関数 (`lib/reservations/availability.ts`)

- `fetchAvailableSlots({ instructorId, fromIso, toIso, durationMin, deliveryType, stepMin })`:
  1. `system_settings` から営業時間・バッファ・予約受付窓を取得
  2. Google Calendar の Free/Busy を取得（連携失敗時は DB のみで継続）
  3. DB の `reservations` から `pending_payment/confirmed/changed` を取得
  4. **対面前後 60 分のバッファ**（Q005、`onsite_buffer_minutes`）を busy に拡張
  5. `duration_min` 単位で営業時間内の候補スロットを `stepMin` 刻みで生成
  6. busy と重ならないものを返す
- `reservation_window_days`（既定 30 日）でレンジ制限

### 1.5 講師プロフィール更新 (Validators / Server Actions)

- `lib/validators/instructor-self.ts`:
  - 講師自身が編集可能な範囲のみ Zod スキーマ化
  - **編集不可（admin のみ）**: `real_name` `real_name_kana` `rank` `priority` `status` `contact_email`（Q018 / Q023）
  - **編集可能**: `nickname` `avatar_url` `public_bio` `contact_phone` `categories` `genres` `transportation_mode` `base_address`
  - インボイス登録番号は `^T\d{13}$` 制約
- `lib/instructor/profile-actions.ts`:
  - `updateInstructorSelfAction`: 講師自身のプロフィール更新（addresses upsert + profiles.display_name 同期 + audit_logs）
  - `upsertInvoiceSettingsAction`: invoice_settings の upsert + audit_logs
  - `disconnectCalendarAction`: API 内部呼び出しのラッパー

### 1.6 講師画面 5ページ

| 画面ID | URL                             | 内容                                             |
| ------ | ------------------------------- | ------------------------------------------------ |
| I002   | `/instructor`                   | 担当予約一覧（今後 / 過去）                      |
| I003   | `/instructor/reservations/[id]` | 予約詳細（顧客名・形式・場所・交通費・Meet URL） |
| I004   | `/instructor/profile`           | 自身のプロフィール表示                           |
| I005   | `/instructor/profile/edit`      | 編集 + インボイス登録番号                        |
| I006   | `/instructor/calendar`          | Calendar 連携状態と連携/解除ボタン               |

予約詳細画面は **Q018 準拠**：

- 顧客個人情報は予約に必要な範囲（保護者氏名 + 子供のニックネーム/カナ）のみ
- 対面の場合のみ住所表示
- オンラインの場合は Meet URL のみ表示

### 1.7 講師ナビゲーションとレイアウト

- `InstructorSidebarNav` (Client Component、`usePathname`)
- 4 メニュー: 予約一覧 / プロフィール / Calendar連携 / メッセージ
- レイアウトを左サイド 240px + 上部ヘッダー + メイン構成に強化（管理者画面と同等の構造）

## 2. 変更したファイル一覧

### 新規（13）

**lib（5）**

- `src/lib/google/oauth.ts`
- `src/lib/reservations/availability.ts`
- `src/lib/instructor/profile-actions.ts`
- `src/lib/validators/instructor-self.ts`

**lib（更新）**

- `src/lib/google/calendar.ts`（Phase 0 のスケルトンから本実装に置き換え）

**API Route（3）**

- `src/app/api/instructor/google-calendar/auth-url/route.ts`
- `src/app/api/instructor/google-calendar/callback/route.ts`
- `src/app/api/instructor/google-calendar/disconnect/route.ts`

**画面（5）**

- `src/app/(instructor)/instructor/page.tsx`（I002）
- `src/app/(instructor)/instructor/reservations/[id]/page.tsx`（I003）
- `src/app/(instructor)/instructor/profile/page.tsx`（I004）
- `src/app/(instructor)/instructor/profile/edit/page.tsx`（I005）
- `src/app/(instructor)/instructor/calendar/page.tsx`（I006）

**components（2）**

- `src/components/instructor/sidebar-nav.tsx`
- `src/components/instructor/profile-form.tsx`

### 更新（1）

- `src/app/(instructor)/layout.tsx`（サイドナビ + ヘッダー強化）

### 統計

- 全 TS/TSX: **93 ファイル**（Phase 3 の 80 から +13）

## 3. 検証結果

| 項目                         | 結果                                         |
| ---------------------------- | -------------------------------------------- |
| TS/TSX 厳密括弧バランス      | ✅ 0件不整合（regex `/\\//` の誤検出は除外） |
| `@/` alias 解決              | ✅ 0件失敗                                   |
| 必須ファイル存在チェック     | ✅ 15/15                                     |
| use server / use client 違反 | ✅ 0件                                       |

## 4. QA 反映

| QA       | 反映箇所                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q005** | `system_settings.reservation_open_hour/close_hour/onsite_buffer_minutes/online_buffer_minutes/reservation_window_days` を読み出し空き枠生成 |
| **Q006** | `createCalendarEvent` で `conferenceData.createRequest` を付与し Google Meet URL 自動発行                                                   |
| **Q012** | `invoice_settings` テーブル + Zod 制約 `^T\d{13}$` + プロフィール編集画面のフォーム                                                         |
| **Q018** | 講師の本名・連絡先メール・電話・自宅住所は本人 + admin のみ閲覧。プロフィール編集では本名は表示のみ                                         |
| **Q023** | rank は admin のみ編集可。プロフィール画面では「ランク」をバッジ表示するのみ                                                                |

## 5. セキュリティ・運用面

### 5.1 OAuth トークン保護（SEC006）

- access_token / refresh_token は **AES-256-GCM 暗号化**して `calendar_connections` に保存
- `ENCRYPTION_KEY` は環境変数（Vercel Secrets で管理）
- `getValidAccessToken` 内で期限切れ時のみ refresh + 暗号化再保存

### 5.2 state / nonce の HttpOnly Cookie 保護

- gcal_oauth_state / gcal_oauth_instructor を 10分有効
- callback 後に削除（state mismatch 防止）

### 5.3 同期失敗カウンタ

- refresh 失敗時に `sync_failures` をインクリメント
- 画面で 1 回以上の失敗を警告表示し、再連携を促す

### 5.4 連携解除時の挙動

- DB の `calendar_connections` レコードを削除
- 注: Google 側の権限取り消しはユーザー自身で `myaccount.google.com/permissions` から行ってもらう（READMEに記載予定）

## 6. 動作確認手順

### 6.1 前提

- Phase 0/1/2/3 のセットアップ完了
- Google Cloud Console で OAuth 2.0 クライアント作成
  - 承認済みリダイレクト URI: `http://localhost:3000/api/instructor/google-calendar/callback`
  - スコープ: `calendar.events` `calendar.readonly` `userinfo.email`
- `.env.local` に `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` を設定

### 6.2 シナリオ

```bash
cd kizashi
pnpm install
supabase start && supabase db reset
pnpm gen:types
pnpm dev
```

1. **講師ログイン**:
   - `/admin/login` で admin → `/admin/instructors/00000000-0000-0000-0000-000000000099`
   - 「招待メールを送信」→ email_notification_logs に queued
   - DB の `email_notification_logs.payload.accept_url` を取得し、URL でアクセス
   - パスワード設定 → `/instructor` へ自動遷移

2. **プロフィール編集**:
   - `/instructor/profile` で seed の「さくら先生」表示
   - 「編集」→ ニックネーム / 自己紹介 / カテゴリ / 移動手段 / 自宅住所を変更
   - 保存後 `/instructor/profile?updated=1` にフラッシュ

3. **インボイス登録**:
   - 編集画面の下部で T+13桁を入力 → 保存
   - 不正フォーマット時は `?error=invoice_validation`

4. **Calendar 連携**:
   - `/instructor/calendar` で「Google Calendar と連携する」
   - Google 認可画面 → 戻り → `?connected=1` フラッシュ
   - DB の `calendar_connections` に暗号化トークン保存を確認
   - 「連携を解除」を押下 → レコード削除

5. **空き枠取得**（Phase 6 で UI から呼ぶ）:
   - 単体テストや REPL 経由で `fetchAvailableSlots()` を呼んで動作確認可
   - 講師の Calendar に予定がある時間 + 既存予約 + 対面 60 分バッファ が除外される

## 7. 未実装の内容（Phase 5 以降）

- **講師メッセージ画面 (I007/I008)**: Phase 10 で実装
- **管理者から講師の Calendar 連携状態を見る UI**: 既に管理者の講師詳細画面で表示済み（Phase 3）
- **Calendar イベントの自動同期スケジューラ**: Phase 13 の Cron で `last_synced_at` を更新
- **空き枠取得の API endpoint** (`GET /api/customer/instructors/:id/slots`): Phase 5/6 で顧客画面から呼ぶ際に実装
- **管理者による講師ランク・優先度・status の変更 UI**: 講師編集画面で対応済み（Phase 3）

## 8. リスク・注意事項

### 8.1 Free/Busy API の精度

- Google Calendar の `freeBusy` は busy 期間のみを返す。終日イベントや「予定あり」マーク外の時間は free 扱い
- 個別イベントの subject / 場所は取得しない（プライバシー配慮）

### 8.2 conferenceData の権限

- Workspace アカウントでは conferenceData の Meet 発行が組織ポリシーで制限されることがある
- 個人 Google アカウントは標準で利用可能

### 8.3 Calendar イベントの所属カレンダー

- 現実装は `calendars/primary/events` 固定
- 講師が「仕事用カレンダー」を別に持つ場合は Phase 12 以降で `calendar_id` 選択 UI を追加検討

### 8.4 トークン失効時のリトライ

- refresh 1回失敗で sync_failures インクリメント、即時リトライしない
- ユーザー操作（再連携）で復旧する設計

## 9. 次のフェーズ（Phase 5: 顧客基本画面）

Phase 5 では以下を実装:

1. 顧客マイページダッシュボード（C002）— チケット残数 / 次回予約 / 履歴
2. 顧客プロフィール（C014）と編集（C015）— 子供の登録/編集を含む
3. 講師一覧（C003） — `instructors_public` ビューを使用、カテゴリ・ジャンル絞込
4. 講師詳細（C004） — 公開プロフィール表示、予約導線
5. shadcn/ui 追加: Tabs / Avatar / Skeleton（必要に応じて）

Phase 5 を進めますか？「Phase 5 進めて」とお伝えください。
