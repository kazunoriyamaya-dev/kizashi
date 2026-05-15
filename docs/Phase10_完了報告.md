# Phase 10 完了報告 - メッセージ機能

実装日: 2026-05-12
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 ドメインロジック (`lib/messaging/threads.ts`)

3 種類のスレッドタイプを統合管理:

- **`admin_customer`**: 顧客 ⇔ 管理者 (customer_id 単位で 1 スレッド)
- **`instructor_customer`**: 顧客 ⇔ 講師 (組み合わせで 1 スレッド、**予約実績必須 F034**)
- **`admin_instructor`**: 管理者 ⇔ 講師 (instructor_id 単位で 1 スレッド)

主要関数:

- `findOrCreateThread(input)`: 既存スレッドを検索 or 作成（予約実績ガードあり）
- `customerCanMessageInstructor(customerId, instructorId)`: 予約実績の有無で判定
- `listThreadsForUser(role, profileId)`: ロール別に参加 / 監査可能スレッドを取得（未読カウント付き）
- `getThreadWithMessages(threadId, role, profileId)`: 詳細 + メッセージ一覧（参加権限再検証）
- `sendMessage(threadId, senderProfileId, body)`: 1〜5000文字の本文を送信
- `markThreadAsRead(threadId, role)`: ロールに応じて `read_at_by_admin` / `read_at_by_other` を NOW に更新

### 1.2 API Route Handlers

- **`GET /api/messages/threads`** (API023): ロール別スレッド一覧
- **`GET /api/messages/threads/:id`**: スレッド詳細 + メッセージ + 自動既読
- **`POST /api/messages/:threadId`** (API024): メッセージ送信（Zod バリデーション、参加権限再検証）

### 1.3 Server Actions (`lib/messaging/actions.ts`)

- `sendMessageAction(threadId, formData)`: 共通送信。3ロール全画面で `revalidatePath`
- `openCustomerInstructorThreadAction(instructorId)`: 顧客 → 講師スレッド作成（予約実績必須）
- `openCustomerAdminThreadAction()`: 顧客 → 管理者スレッド作成
- `openInstructorAdminThreadAction()`: 講師 → 管理者スレッド作成
- `openAdminCustomerThreadAction(customerId)` / `openAdminInstructorThreadAction(instructorId)`: 管理者発信

### 1.4 共通 UI コンポーネント

- **`ThreadList`** (`components/messaging/thread-list.tsx`):
  - スレッドカード、未読数バッジ、相手名・タイプラベル・最終メッセージプレビュー・タイムスタンプ
- **`MessageChat`** (`components/messaging/message-chat.tsx`):
  - LINE 風のバブル表示（自分は右、相手は左、管理者の発言は黄色背景で識別）
  - `auditMode` で admin の監査閲覧時に黄色帯表示（Q015）
  - `useTransition` で Server Action 呼び出し、送信後に入力欄クリア

### 1.5 顧客側画面 (C012/C013)

- **`/mypage/messages`**: 「管理者にメッセージ」ボタン + 自分のスレッド一覧
- **`/mypage/messages/[threadId]`**: チャット画面 + 自動既読
- 講師詳細画面（C004）に「メッセージを送る」ボタンを追加
  - 予約実績がある場合のみ表示
  - 無い場合は `?error=no_reservation` メッセージ表示

### 1.6 講師側画面 (I007/I008)

- **`/instructor/messages`**: 「管理者にメッセージ」ボタン + 担当顧客とのスレッド一覧
- **`/instructor/messages/[threadId]`**: チャット画面 + 自動既読

### 1.7 管理者側画面 (A015/A016)

- **`/admin/messages`**: 全スレッド一覧（Q015 監査閲覧）+ プライバシー注意バナー
- **`/admin/messages/[threadId]`**: チャット画面 + 監査モード表示
  - 監査時に `audit_logs.action='message_thread.viewed'` を記録
  - `instructor_customer` スレッドは `auditMode=true` で黄色帯
- 顧客詳細・講師詳細から「メッセージを開く」ボタンで直接開始可能

## 2. 変更したファイル一覧

### 新規（13）

**lib（2）**

- `src/lib/messaging/threads.ts`
- `src/lib/messaging/actions.ts`

**components（2）**

- `src/components/messaging/thread-list.tsx`
- `src/components/messaging/message-chat.tsx`

**API Route（3）**

- `src/app/api/messages/threads/route.ts`
- `src/app/api/messages/threads/[id]/route.ts`
- `src/app/api/messages/[threadId]/route.ts`

**画面（6）**

- `src/app/(customer)/mypage/messages/page.tsx` (C012)
- `src/app/(customer)/mypage/messages/[threadId]/page.tsx` (C013)
- `src/app/(instructor)/instructor/messages/page.tsx` (I007)
- `src/app/(instructor)/instructor/messages/[threadId]/page.tsx` (I008)
- `src/app/(admin)/admin/messages/page.tsx` (A015)
- `src/app/(admin)/admin/messages/[threadId]/page.tsx` (A016)

### 更新（2）

- `src/app/(customer)/mypage/instructors/[id]/page.tsx`：予約実績がある場合に「メッセージを送る」追加
- `src/app/(admin)/admin/customers/[id]/page.tsx`：ヘッダー右に「メッセージを開く」追加
- `src/app/(admin)/admin/instructors/[id]/page.tsx`：操作ボタン群に「メッセージを開く」追加

### 統計

- 全 TS/TSX: **158 ファイル**（Phase 9 の 145 から +13）

## 3. 検証結果

| 項目                         | 結果         |
| ---------------------------- | ------------ |
| TS/TSX 厳密括弧バランス      | ✅ 0件不整合 |
| `@/` alias 解決              | ✅ 0件失敗   |
| 必須ファイル存在チェック     | ✅ 13/13     |
| use server / use client 違反 | ✅ 0件       |

## 4. QA 反映

| QA                            | 反映箇所                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| **F017** 管理者メッセージ監査 | `/admin/messages` で全スレッド閲覧、`auditMode` で警告表示                    |
| **F023** 講師メッセージ       | `/instructor/messages` で担当顧客スレッド、予約実績必須                       |
| **F034** 顧客メッセージ       | 講師詳細で予約実績があるときのみ「メッセージを送る」表示                      |
| **Q015** 監査の利用規約明記   | A015 のページに「利用規約に明記済み」表示、`message_thread.viewed` audit_logs |
| **Q020** 退会後メッセージ保持 | Phase 1 で物理削除なし設計、本Phaseでも変更なし                               |

## 5. セキュリティ機構

### 5.1 多重防御

- **RLS（Phase 1）**: messages テーブルへの直接アクセスはスレッド参加者 + admin のみ
- **アプリ層**: 全 API / Server Action で `getCurrentUser` → ロール検証 → `getThreadWithMessages` で参加権限再検証
- **予約実績ガード**: `instructor_customer` スレッド作成時に F034 を関数レベルで強制

### 5.2 XSS 対策

- React のデフォルトエスケープを利用
- `whitespace-pre-wrap break-words` で改行と長文を安全に表示
- 5000文字制限

### 5.3 監査ログ

- `audit_logs.action='message_thread.viewed'` を A016 アクセス時に記録
- 管理者がいつ誰のスレッドを閲覧したかが追跡可能
- 既存の audit_logs trigger により改ざん不可

### 5.4 既読の分離

- `read_at_by_admin` / `read_at_by_other` で管理者と顧客/講師の既読を独立管理
- 未読カウントは各ロールから見て独立

## 6. 動作確認手順

```bash
cd kizashi
pnpm dev
```

### シナリオ

1. **顧客 → 管理者 スレッド作成**:
   - `/mypage/messages` → 「管理者にメッセージを送る」
   - `/mypage/messages/[threadId]` でメッセージ入力 → 送信
   - 管理者は `/admin/messages` で受信を確認

2. **顧客 → 講師 スレッド (予約実績必須)**:
   - 予約実績がない講師詳細 → 「メッセージを送る」非表示
   - 予約成立後 → 「メッセージを送る」表示 → 押下でスレッド作成

3. **管理者 → 顧客 / 講師 発信**:
   - `/admin/customers/[id]` で「メッセージを開く」→ 自動的に admin_customer スレッド作成
   - `/admin/instructors/[id]` で「メッセージを開く」→ admin_instructor スレッド

4. **管理者監査 (Q015)**:
   - `/admin/messages/[threadId]` で instructor_customer スレッドを開く
   - 黄色帯「監査モード」表示
   - `audit_logs` に `message_thread.viewed` 記録

5. **既読更新**:
   - 顧客がスレッドを開く → `read_at_by_other` が NOW に
   - 管理者が同じスレッドを開く → `read_at_by_admin` が NOW に
   - 未読カウントが減る

## 7. 未実装の内容

- **リアルタイム更新（WebSocket）**: 現状はページ再読み込みで反映。Supabase Realtime 連携は Phase 13 候補
- **メッセージ通知（メール/LINE/Push）**: Phase 13 で実送信
- **既読アイコン**（チャット内）: Phase 14 で UX 改善時に
- **画像/ファイル添付**: 設計書上 MVP 対象外 (API024 注意事項)
- **代替講師提案フロー**（Q014 から派生）: Phase 13 で「予約変更通知」と組み合わせて

## 8. リスク・注意事項

### 8.1 大量メッセージのページネーション

- 現状は最大 500 件をクライアントに送る
- 5000 件超のスレッドが出ると遅くなる
- Phase 14 で `range` 指定の追加読み込みを検討

### 8.2 監査閲覧の悪用防止

- `audit_logs` に閲覧履歴が残るが、頻度制限はかけていない
- Phase 14 のセキュリティ強化時に、特定スレッドの閲覧回数モニタリングを検討

### 8.3 予約実績ガードの抜け道

- 体験予約も「予約実績」としてカウントされる
- 体験キャンセル後も `reservations` レコードは残るためメッセージ可能
- 設計上は問題なし（Q020: 退会後保持と同等）

### 8.4 XSS の二重チェック

- React のエスケープに依存
- HTMLタグを含むメッセージはタグごと表示される
- マークダウン対応は Phase 14 候補

## 9. 次のフェーズ（Phase 11: 交通費計算）

Phase 11 で実装:

1. **Google Maps Routes API ラッパー (`lib/google/maps.ts`)**
   - 車: 距離取得 → 往復 × 30円/km、小数点切り上げ (Q009)
   - 電車: 運賃取得（取得不可は手動入力 Q008）
2. **予約成立時の交通費自動計算 + travel_fees INSERT**
3. **手動入力 UI** (管理者 / 講師)
4. **A004 / I003 で交通費表示更新**

Phase 11 を進めますか？「Phase 11 進めて」とお伝えください。
