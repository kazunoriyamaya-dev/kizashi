# Phase 5 完了報告 - 顧客基本画面

実装日: 2026-05-09
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 shadcn/ui 拡張

- `Avatar` / `AvatarImage` / `AvatarFallback`（Radix UI、講師カード・詳細用）
- `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent`（プロフィール画面のタブ用）
- `Skeleton`（ローディング表示用）

### 1.2 顧客モバイル下部固定ナビゲーション

- `CustomerBottomNav` (Client Component、`usePathname` でアクティブ判定)
- 5 タブ: ホーム / 講師 / 予約 / メッセージ / プロフィール
- セーフエリア対応 (`pb-safe`)
- スマホファースト UI（max-w-screen-md）+ sticky ヘッダー

### 1.3 顧客プロフィール / 子供管理 (Validators + Server Actions)

**Validators** (`lib/validators/customer.ts`):

- `CustomerProfileSchema` — 保護者氏名・フリガナ・電話・主住所
- `ChildSchema` — Q019 準拠（氏名・フリガナ・生年月日・メモのみ、学校名・写真なし）
- `birth_date` は `^\d{4}-\d{2}-\d{2}$` 制約

**Server Actions** (`lib/customer/profile-actions.ts`):

- `updateCustomerProfileAction` — `customers` + `profiles` + `addresses` の3テーブル更新
- `addChildAction` — children INSERT、`23505` UNIQUE 違反は「同じ情報が登録済」として扱う
- `updateChildAction` — children UPDATE
- `deleteChildAction` — `23503` FK 違反は「予約あり」として扱う

### 1.4 C002 顧客ダッシュボード

- KPI カード 4種（チケット残数・次回予約・予約履歴件数・購入金額）
- **チケット残数（家族合算 Q024）**: customer_id 単位で active かつ remaining > 0 の合計
- **新規顧客導線**: 子供登録 0 件なら登録 CTA、未使用体験あり子供がいれば体験予約 CTA を強調
- 次回予約は時刻・カテゴリ・形式・講師ニックネームを表示
- 購入金額（累計）と詳細遷移ボタン

### 1.5 C014 顧客プロフィール表示

- 保護者情報カード（名前・フリガナ・メール・電話・SSO種別バッジ）
- 子供情報カード（一覧、体験済/未使用バッジ）
- 主住所カード（任意）

### 1.6 C015 顧客プロフィール編集

- 保護者プロフィール編集フォーム（氏名・フリガナ・表示名・電話）
- 主住所編集フォーム（任意）
- **子供管理セクション**:
  - 既存子供は `ChildRow` Client Component で個別に編集モード切り替え
  - 編集 / 削除（trial_used が false の時のみ）
  - 新規追加フォーム（氏名・フリガナ・生年月日・メモ）
- エラーメッセージは日本語化、UNIQUE / FK 制約違反を分離

### 1.7 C003 講師一覧

- `instructors_public` ビュー経由で公開列のみ取得（Q018）
- カテゴリ絞り込みフィルタ（Badge クリックで切替）
- ニックネーム / bio / ジャンルで部分一致検索
- ランクで降順ソート（Gold → Silver → Bronze → Regular）
- `InstructorCard` コンポーネント: アバター + ニックネーム + ランク + カテゴリ + ジャンル + 自己紹介プレビュー + **指名料**

### 1.8 C004 講師詳細

- アバター（フォールバックは ニックネーム冒頭2文字）
- ランクバッジ・対応カテゴリ・対応ジャンル・自己紹介
- **Q023 指名料の明示**: 「+¥1,500」など、無料は「無料」表記
- sticky 下部に「この講師に予約する」ボタン → `/mypage/reservations/new?instructorId=xxx`

### 1.9 公開講師取得 API (API014)

- `GET /api/customer/instructors`
- `instructors_public` ビュー経由
- `?category=learning|sports|art` フィルタ対応
- `system_settings` の指名料を結合して返却

## 2. 変更したファイル一覧

### 新規（13）

**lib（3）**

- `src/lib/customer/dashboard-queries.ts`
- `src/lib/customer/profile-actions.ts`
- `src/lib/validators/customer.ts`

**components（5）**

- `src/components/ui/avatar.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/customer/bottom-nav.tsx`
- `src/components/customer/instructor-card.tsx`
- `src/components/customer/child-row.tsx`

**画面（4）**

- `src/app/(customer)/mypage/instructors/page.tsx` (C003)
- `src/app/(customer)/mypage/instructors/[id]/page.tsx` (C004)
- `src/app/(customer)/mypage/profile/page.tsx` (C014)
- `src/app/(customer)/mypage/profile/edit/page.tsx` (C015)

**API Route（1）**

- `src/app/api/customer/instructors/route.ts` (API014)

### 更新（2）

- `src/app/(customer)/layout.tsx` — 下部ナビ + sticky header
- `src/app/(customer)/mypage/page.tsx` (C002) — プレースホルダーから本実装へ

### 統計

- 全 TS/TSX: **107 ファイル**（Phase 4 の 93 から +14）

## 3. 検証結果

| 項目                         | 結果         |
| ---------------------------- | ------------ |
| TS/TSX 厳密括弧バランス      | ✅ 0件不整合 |
| `@/` alias 解決              | ✅ 0件失敗   |
| 必須ファイル存在チェック     | ✅ 15/15     |
| use server / use client 違反 | ✅ 0件       |

## 4. QA 反映

| QA       | 反映箇所                                                                    |
| -------- | --------------------------------------------------------------------------- |
| **Q001** | プロフィール画面で兄弟複数登録可能（ペア予約は Phase 6 で UI 実装）         |
| **Q003** | children テーブルの UNIQUE 制約が効くことで重複追加時に明確なエラー表示     |
| **Q018** | 講師一覧/詳細は `instructors_public` ビュー経由で本名・住所・連絡先を非表示 |
| **Q019** | ChildSchema は氏名・カナ・生年月日・メモのみ（学校・写真は持たない）        |
| **Q023** | 講師カード/詳細で指名料を明示 (`+¥1,500` 等)                                |
| **Q024** | ダッシュボードのチケット残数は家族合算（customer_id 単位）                  |

## 5. 動作確認手順

```bash
cd kizashi
pnpm install
supabase start && supabase db reset
pnpm gen:types
pnpm dev
```

### シナリオ

1. **顧客ログイン**: `/login` → Google or LINE SSO（Phase 2 実装済み）→ `/mypage`
2. **ダッシュボード**: 子供 0 名なら「お子様情報を登録しましょう」CTA、未使用体験ありなら黄色バナー
3. **プロフィール編集**:
   - `/mypage/profile/edit`
   - 保護者氏名 / 電話 / 住所を編集 → 保存
   - 子供「顧客花子」を編集（フォームが展開）→ 保存
   - 同じ氏名・カナ・生年月日で新規追加 → `?error=child_duplicate`
   - 体験未使用の子供は削除可能
4. **講師一覧**:
   - `/mypage/instructors` → seed の「さくら先生」(Silver) が指名料 +¥1,000 表示
   - カテゴリ「学習」をクリック → フィルタ
5. **講師詳細**:
   - 講師カードクリック → `/mypage/instructors/[id]`
   - 「この講師に予約する」ボタン → `/mypage/reservations/new?instructorId=xxx`（Phase 6 で本実装）

## 6. 未実装の内容（Phase 6 以降）

- **C005 通常予約登録**: Phase 6
- **C006 チケット購入**: Phase 7（Stripe Checkout）
- **C007 予約サンキュー**: Phase 6/7
- **C008 体験予約**: Phase 8
- **C009 予約一覧**: Phase 6/9
- **C010 予約詳細**: Phase 6/9
- **C011 予約変更**: Phase 9
- **C012/C013 顧客メッセージ**: Phase 10
- **チケット購入画面 `/mypage/tickets`**: Phase 7
- **空き枠取得 API `/api/customer/instructors/:id/slots`**: Phase 6（Phase 4 の `fetchAvailableSlots` を呼び出し）

## 7. リスク・注意事項

### 7.1 instructors_public ビューの行レベルセキュリティ

- ビューは `security_invoker=false`（オーナー権限実行）でステータス active のみ返す
- `GRANT SELECT TO anon, authenticated` 済み
- ベーステーブルへの直接 SELECT は本人 + admin に限定

### 7.2 子供削除の制約

- reservations.child_id は ON DELETE RESTRICT
- 子供に紐付く予約があれば削除不可（UI でエラー表示）
- trial_used が true の子供は削除ボタンを表示しない（誤操作防止）

### 7.3 mobile-first レイアウト

- 顧客画面は max-w-screen-md（768px）に制限
- 下部ナビは `fixed bottom-0` で常時表示、`pb-24` で本文下にスペース確保

## 8. 次のフェーズ（Phase 6: 通常予約）

Phase 6 では以下を実装:

1. **C005 通常予約登録**:
   - 講師選択（C004 から遷移）
   - チケット選択（保有チケット一覧から）
   - 子供選択（ペアレッスンの場合は複数選択 + フリーテキスト）
   - 形式（オンライン / 対面）と場所入力
   - 空き枠選択（Phase 4 の fetchAvailableSlots を使用）
   - 確定処理（DB transaction + EXCLUDE 制約）
2. 予約 API: `POST /api/customer/reservations` (API016)
3. 空き枠 API: `GET /api/customer/instructors/:id/slots` (API015)
4. **チケット消化** + **Google Calendar イベント作成 (Q006 Meet URL)** + **通知ログ**
5. C007 サンキュー画面
6. C009/C010 予約一覧/詳細
7. EXCLUDE 制約の競合 (`23P01`) ハンドリング

Phase 6 を進めますか？「Phase 6 進めて」とお伝えください。
