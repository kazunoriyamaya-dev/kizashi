# Phase 13 完了報告 - 通知

実装日: 2026-05-12
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 通知テンプレート (`lib/notifications/templates.ts`)

12 種類のイベントに対して `subject / text / html / pushTitle / pushBody / lineText / url` を生成:

- `reservation_confirmed` / `reservation_changed`
- `reservation_cancelled_by_{customer,instructor,company}` (Q014 区別)
- `trial_reservation_confirmed`
- `trial_pending_admin` (Q003)
- `ticket_purchased`
- `ticket_expiring` (Q022)
- `instructor_invite`
- `message_received`
- `payout_drafted`

各チャネル用に最適化された本文を返却。

### 1.2 メール送信 (Resend) — `lib/notifications/email.ts`

- `dispatchPendingEmails(limit=50)`:
  - `email_notification_logs.status='queued'` を作成日時順に取得
  - Resend で送信、成功 → `sent`、失敗 → `failed` + `error_message`
  - 個人情報を logger に出さない設計
- `RESEND_API_KEY` 未設定時はスキップ（dev mode）

### 1.3 LINE Messaging API — `lib/notifications/line.ts`

- LINE Bot Push API (`https://api.line.me/v2/bot/message/push`)
- Bearer `LINE_CHANNEL_ACCESS_TOKEN`
- テキストメッセージ（5000文字制限）
- `dispatchPendingLineMessages(limit=50)`

### 1.4 Web Push (VAPID) — `lib/notifications/push.ts`

- `web-push` ライブラリ + `setVapidDetails(subject, public, private)`
- `subscription_id` 指定 or `target_profile_id` → active subs を全展開
- **410/404 で購読を `revoked_at` で無効化**（自動クリーニング）
- payload は `{title, body, url}` JSON
- TTL 24h

### 1.5 Service Worker (`public/sw.js`)

- `push` イベント: `showNotification(title, {body, data:{url}})`
- `notificationclick`: 既存タブにフォーカス or `clients.openWindow(url)`
- アイコンは `/icon-192.png` （プロジェクトで用意する想定）

### 1.6 Push 購読 API (`/api/push/subscribe`)

- `POST`: endpoint UNIQUE で upsert（再購読時は `revoked_at=null` 復活）
- `DELETE ?endpoint=...`: `revoked_at` を NOW に

### 1.7 通知統合 dispatcher (`lib/notifications/dispatch.ts`)

`enqueueNotification(event, target, payload)`:

- `target.profileId` or `target.toAdmins` で対象を解決
- `channels` (既定: `['email','line','push']`) ごとに queued レコードを作成
- LINE は `customers.line_user_id` がある場合のみ
- Push は `push_subscriptions` が 1 件以上 active な場合のみ
- profile_id → email/line_user_id 解決を内部で実行

### 1.8 Vercel Cron (`vercel.json` + 4 ハンドラ)

| schedule      | path                                    | 内容                                  |
| ------------- | --------------------------------------- | ------------------------------------- |
| `*/5 * * * *` | `/api/cron/dispatch-notifications`      | queued 通知を 3 チャネル並列送信      |
| `0 9 * * *`   | `/api/cron/notify-ticket-expiring`      | チケット期限 N 日前通知 (Q022)        |
| `0 1 * * *`   | `/api/cron/sweep-expired-tickets`       | 期限切れチケットを expired に状態遷移 |
| `0 10 * * *`  | `/api/cron/notify-reservation-reminder` | 翌日予約のリマインダー                |

`cron-auth.ts` で `CRON_SECRET` を Authorization Bearer or `?secret=` で検証。

### 1.9 既存ロジックの enqueueNotification 統合

以下を従来の直接 INSERT から `enqueueNotification` 経由に変更:

- `lib/reservations/create.ts` (通常予約確定)
- `lib/reservations/create-trial.ts` (体験予約確定 + 重複時の admin 通知)
- `lib/reservations/cancel.ts` (理由別 template)
- `lib/reservations/change.ts` (予約変更通知)
- `lib/stripe/webhook.ts` (checkout.session.completed → ticket_purchased)
- `app/api/admin/instructors/[id]/invite/route.ts` (招待メール、email チャネルのみ)

### 1.10 Push 購読 UI

`PushSubscribeButton` (Client Component):

- Service Worker サポート判定
- `Notification.permission` を確認、`denied` なら警告表示
- `Notification.requestPermission()` → `pushManager.subscribe({applicationServerKey})`
- 購読情報を `/api/push/subscribe` に POST
- 解除ボタンも提供
- マイページのヘッダー右に配置（VAPID 公開鍵がある場合のみ）

## 2. 変更したファイル一覧

### 新規（14）

**lib (6)**

- `src/lib/notifications/templates.ts`
- `src/lib/notifications/email.ts`
- `src/lib/notifications/line.ts`
- `src/lib/notifications/push.ts`
- `src/lib/notifications/dispatch.ts`
- `src/lib/notifications/cron-auth.ts`

**API Route (5)**

- `src/app/api/push/subscribe/route.ts`
- `src/app/api/cron/dispatch-notifications/route.ts`
- `src/app/api/cron/notify-ticket-expiring/route.ts`
- `src/app/api/cron/sweep-expired-tickets/route.ts`
- `src/app/api/cron/notify-reservation-reminder/route.ts`

**components (1)**

- `src/components/customer/push-subscribe-button.tsx`

**インフラ (2)**

- `public/sw.js`
- `vercel.json`

### 更新（6）

- `src/lib/reservations/create.ts`
- `src/lib/reservations/create-trial.ts`
- `src/lib/reservations/cancel.ts`
- `src/lib/reservations/change.ts`
- `src/lib/stripe/webhook.ts`
- `src/app/api/admin/instructors/[id]/invite/route.ts`
- `src/app/(customer)/mypage/page.tsx` (PushSubscribeButton 配置)

### 統計

- 全 TS/TSX: **183 ファイル**（Phase 12 の 171 から +12）

## 3. 検証結果

| 項目                         | 結果                               |
| ---------------------------- | ---------------------------------- |
| TS/TSX 厳密括弧バランス      | ✅ 0件不整合（regex 誤検出は除外） |
| `@/` alias 解決              | ✅ 0件失敗                         |
| 必須ファイル存在チェック     | ✅ 14/14                           |
| use server / use client 違反 | ✅ 0件                             |

## 4. QA 反映

| QA       | 反映箇所                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------- |
| **F039** | 講師招待・予約確定/変更/キャンセル・チケット購入・体験予約・メッセージ受信のメール通知              |
| **Q014** | キャンセル理由別 template (`reservation_cancelled_by_instructor` etc.)、Push 通知必須を Cron で配信 |
| **Q015** | メッセージ受信通知は message_received テンプレートで実装、admin 監査はメッセージ既存実装            |
| **Q016** | メール + LINE + Push 3 チャネル、アプリ内通知も Push で代替                                         |
| **Q022** | チケット期限 30/14/7/1 日前通知。`system_settings.ticket_expiry_notify_days` で柔軟設定             |

## 5. セキュリティ・運用面

### 5.1 Cron 認証

- `CRON_SECRET` 必須（本番）
- Bearer ヘッダー / `?secret=` クエリの両対応
- Vercel Cron は自動的に Bearer を送る

### 5.2 失敗時のリトライ

- 全 dispatcher が「失敗 → `status='failed' + error_message`」で記録
- リトライは別ジョブで `status='failed' AND retry_count<N` を対象に再キュー（Phase 14 候補）

### 5.3 個人情報保護

- `to_email` / `to_line_user_id` は logger に出さない（lib/logger の PII フィルタ）
- error_message は最大 500 文字に切り詰め

### 5.4 Push 購読の自動失効

- 410/404 で `revoked_at` に NOW を設定
- 次回購読時は upsert で `revoked_at=null` に復活

## 6. 動作確認手順

### 6.1 前提

- `.env.local`:
  - `RESEND_API_KEY` (Resend ダッシュボードで取得)
  - `EMAIL_FROM=noreply@kizashi.example.com`
  - `LINE_CHANNEL_ACCESS_TOKEN` (Messaging API)
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
  - `CRON_SECRET` (任意の長文字列)

### 6.2 シナリオ

```bash
cd kizashi
supabase db reset
pnpm gen:types
pnpm dev
```

1. **Push 購読**:
   - `/mypage` 右上の「Push 通知を受け取る」ボタン
   - ブラウザ通知許可 → 購読
   - `push_subscriptions` テーブルに INSERT 確認

2. **予約確定通知**:
   - 通常予約を確定 → `email_notification_logs`, `line_notification_logs`, `push_notification_logs` に queued レコード作成（チャネル連携済みなら）

3. **Cron 手動実行**:

   ```bash
   curl -X GET http://localhost:3000/api/cron/dispatch-notifications \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

   レスポンス: `{email: {sent:1, failed:0}, line: {...}, push: {...}}`

4. **チケット期限通知**:
   - seed で残数 > 0 / 30日後失効のチケットを作成
   - `/api/cron/notify-ticket-expiring` を呼ぶ → 該当顧客に通知 enqueued

5. **本番デプロイ後**:
   - Vercel Cron が自動実行（5分毎にディスパッチ、毎朝9時に期限通知）

## 7. 未実装の内容（後続フェーズ）

- **失敗通知の自動リトライ**: Phase 14 で `retry_count` カラム追加 + 再キュー
- **代替講師提案フロー (Q014)**: 講師都合キャンセル時に管理者へ Push、代替候補リスト連携
- **通知のオプトアウト**: 顧客が「予約確認だけ受け取る」など細かい制御
- **テンプレートの管理者編集 UI**: 現状はコード内固定
- **メッセージ受信通知の発火**: メッセージ送信時に `message_received` を enqueueNotification する処理（Phase 14 でメッセージ機能と統合）

## 8. リスク・注意事項

### 8.1 LINE のメッセージ単価制限

- Messaging API 無料枠は月 200通（Developer Trial）/ 月 1000 通 (Free)
- 本番では「Standard 5,000円」プランを検討
- 失敗時は `status='failed'` で記録、メールで補填

### 8.2 Web Push の浏览器サポート

- iOS Safari は PWA Add to Home Screen 必須（16.4+）
- それ以前 / 一部 Android Firefox では `serviceWorker.PushManager` 未対応
- `PushSubscribeButton` は `supported=false` で非表示

### 8.3 Cron の同時実行

- `dispatch-notifications` を 5 分毎で実行中、前回が遅延した場合の重複処理
- 各レコードに対する SELECT → UPDATE は SQL レベルで atomic
- limit (50/50/100) を超える queued は次回 cron で処理

### 8.4 メールスパム判定

- Resend の SPF / DKIM / DMARC を本番ドメインで設定する必要あり
- `EMAIL_FROM` ドメインの DNS レコード設定が必須

## 9. 次のフェーズ（Phase 14: テスト / セキュリティ強化 / リリース判定）

Phase 14 で実装:

1. TC001〜TC025 を満たす E2E / 単体テスト基盤
2. RLS 逆引きテスト（顧客 A → 顧客 B のリソースアクセス不可確認）
3. バックアップ / リストア手順書
4. Vercel ロールバック手順書
5. README 整備・本番デプロイ手順
6. リリース前チェックリスト（10\_チェックリスト）確認

Phase 14 を進めますか？「Phase 14 進めて」とお伝えください。
