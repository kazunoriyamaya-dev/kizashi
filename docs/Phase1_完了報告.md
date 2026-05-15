# Phase 1 完了報告 - DB / RLS 基盤

実装日: 2026-05-04 〜 2026-05-05
担当: Claude（Cowork mode）

## 1. 実装した内容

### 1.1 Supabase CLI 設定

- `supabase/config.toml`: ローカル開発用設定
  - DB port 54322 / API port 54321 / Studio 54323 / Inbucket 54324
  - Google OAuth 連携設定（`env(GOOGLE_CLIENT_ID)` 参照）
  - LINE Login 用に独自 callback (`/api/auth/line/callback`) を redirect URLs に追加

### 1.2 マイグレーション SQL（13ファイル / 1,959行）

| ファイル                                | 行数 | 内容                                                                                                                                 |
| --------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `20260504000001_extensions.sql`         | 13   | pgcrypto / btree_gist / citext / pg_trgm                                                                                             |
| `20260504000002_enums.sql`              | 80   | 20種の enum 型（role, category, instructor_rank 等）                                                                                 |
| `20260504000003_profiles.sql`           | 51   | profiles, addresses                                                                                                                  |
| `20260504000004_customers_children.sql` | 91   | customers, children + 体験重複判定インデックス + 動的 FK 検証トリガー                                                                |
| `20260504000005_instructors.sql`        | 141  | instructors（公開/非公開分離 Q018）+ calendar_connections + stripe_connect_accounts + invoice_settings + `instructors_public` ビュー |
| `20260504000006_tickets.sql`            | 159  | tickets + customer_tickets + payments + stripe_webhook_events                                                                        |
| `20260504000007_cancel_policies.sql`    | 60   | cancel_policies（Q013 1時間前無料ルール）                                                                                            |
| `20260504000008_reservations.sql`       | 193  | reservations + travel_fees + reservation_changes + trial_pending_reviews + google_meet_links                                         |
| `20260504000009_messages.sql`           | 81   | message_threads + messages + last_message_at自動更新トリガー                                                                         |
| `20260504000010_notifications.sql`      | 97   | email/line/push 通知ログ + push_subscriptions                                                                                        |
| `20260504000011_payouts.sql`            | 126  | payouts + audit_logs + system_settings                                                                                               |
| `20260504000012_functions_triggers.sql` | 272  | RLS用ヘルパー関数 + auth.users トリガー + チケット期限管理 + 体験重複検出                                                            |
| `20260504000013_rls_policies.sql`       | 595  | 全27テーブルの RLS ポリシー                                                                                                          |
| `supabase/seed.sql`                     | 192  | 開発用初期データ                                                                                                                     |

### 1.3 統計

- **27テーブル**（設計書16 + 補完11、Q023向けに `system_settings` 追加で計27）
- **20 enum 型**
- **14関数**（うち `fn_handle_new_user` `fn_validate_address_owner` `fn_set_updated_at` `fn_touch_thread_last_message` `fn_audit_logs_immutable` がトリガー関数）
- **1ビュー** (`instructors_public` 顧客閲覧用)
- **40+ RLSポリシー**

### 1.4 重要な設計判断

#### EXCLUDE制約による二重予約防止 (PERF002 / TC013)

```sql
alter table public.reservations
  add constraint rsv_no_overlap_per_instructor
  exclude using gist (
      instructor_id with =,
      (tstzrange(start_at, end_at, '[)')) with &&
  )
  where (
      instructor_id is not null
      and status in ('pending_payment', 'confirmed', 'changed')
  );
```

- 同一講師の時間枠が重なる予約を DB レベルで拒否
- `cancelled` `completed` `no_show` `draft` は除外（過去予約や未確定は重複計算に含めない）
- 要 `btree_gist` 拡張

#### 体験予約の重複検出 (Q003)

- `children` テーブルに複合インデックス `(lower(name), lower(kana), birth_date)`
- `fn_find_trial_duplicates(name, kana, birth_date)` 関数で完全一致検索
- 重複時は `trial_pending_reviews` に登録 → 管理者承認フロー

#### システム設定の単一行制御 (Q023指名料の集中管理)

- `system_settings.singleton_lock` integer列に `CHECK (singleton_lock = 1)` + UNIQUE INDEX
- 全アプリで参照される設定（指名料・通知タイミング・予約受付時間等）

#### 講師個人情報の保護 (Q018)

- `instructors` ベーステーブル: 本名・住所・連絡先含む
- `instructors_public` ビュー: nickname / avatar / public_bio / categories / rank のみ
- RLS: 本人 + admin のみベーステーブルにアクセス可能、その他は ビュー経由

#### Stripe Webhook 冪等性 (TC010)

- `stripe_webhook_events.event_id` UNIQUE
- 受信時に挿入 → 重複 INSERT は失敗 → 既処理として扱う

#### audit_logs の不変性 (SEC005)

- INSERT のみ許可
- `fn_audit_logs_immutable` トリガーで UPDATE / DELETE を例外発生

### 1.5 RLS ポリシー方針（実装）

| テーブル                          | SELECT                  | INSERT/UPDATE/DELETE                           |
| --------------------------------- | ----------------------- | ---------------------------------------------- |
| profiles                          | 自分 + admin            | 自分(限定) + admin、INSERT は auth trigger     |
| addresses                         | 所有者 + admin          | 所有者 + admin                                 |
| customers                         | 自分 + admin            | 自分(更新) + admin、INSERT は auth trigger     |
| children                          | 親(customer) + admin    | 親 + admin                                     |
| instructors                       | 本人 + admin            | 本人(更新) + admin                             |
| instructors_public ビュー         | 全員                    | (Read only)                                    |
| calendar_connections              | 本人 + admin            | 本人 + admin                                   |
| stripe_connect_accounts           | 本人 + admin            | admin（webhook は service_role）               |
| invoice_settings                  | 本人 + admin            | 本人 + admin                                   |
| tickets                           | active なら全員         | admin                                          |
| customer_tickets                  | 本人 + admin            | admin（webhook は service_role）               |
| payments                          | 本人 + admin            | admin（webhook は service_role）               |
| stripe_webhook_events             | admin                   | admin（service_role）                          |
| cancel_policies                   | 全員                    | admin                                          |
| reservations                      | 本人 + 担当講師 + admin | 本人(自分のみ INSERT/UPDATE)、admin            |
| travel_fees                       | 関係者 + admin          | admin                                          |
| reservation_changes               | 関係者 + admin          | admin                                          |
| trial_pending_reviews             | 本人 + admin            | admin                                          |
| google_meet_links                 | 関係者 + admin          | admin                                          |
| message_threads                   | 参加者 + admin          | 参加者(INSERT) + admin                         |
| messages                          | スレッド参加者 + admin  | スレッド参加者(INSERT)、UPDATE/DELETE 不可     |
| payouts                           | 本人 + admin            | admin                                          |
| audit_logs                        | admin                   | admin/service_role(INSERT)、UPDATE/DELETE 不可 |
| email/line/push_notification_logs | 本人 + admin            | admin（service_role）                          |
| push_subscriptions                | 本人 + admin            | 本人 + admin                                   |
| system_settings                   | 全員(SELECT)            | admin                                          |

### 1.6 自動化されたフック

#### `auth.users` INSERT → profile / customer 自動作成

```sql
trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.fn_handle_new_user();
```

- `raw_user_meta_data.role` を見て profile を作成
- role='customer' なら customers レコードも自動作成
- 講師は admin が招待する設計のため自動 customer 化を防ぐ

#### `updated_at` カラム自動更新

- `fn_set_updated_at()` 関数
- マイグレーション末尾の DO ブロックで `updated_at` 列を持つ全テーブルに自動でトリガー設定

#### メッセージスレッドの `last_message_at` 自動更新

- `fn_touch_thread_last_message()` トリガー関数
- messages INSERT 時にスレッドの最終メッセージ時刻を更新

### 1.7 database.ts 型定義

- 27テーブル + 1ビュー + 14関数 + 20 enum を `src/types/database.ts` に手書きで定義
- `Tables<>` `TablesInsert<>` `TablesUpdate<>` `Views<>` のジェネリックヘルパー
- `pnpm gen:types` を実行すれば Supabase が同形式で自動上書きする

## 2. 検証結果

| 項目                        | 結果                |
| --------------------------- | ------------------- |
| 括弧バランス                | ✅ 全14ファイル整合 |
| ドル引用 `$$...$$` バランス | ✅ 全偶数           |
| FK forward reference        | ✅ 0件              |
| 未定義テーブル参照          | ✅ 0件              |
| enum 型 forward reference   | ✅ 0件              |

実 DB（Docker / Supabase CLI / psql）が当環境で利用不可のため、構文の静的解析のみで検証。
**ローカル動作確認は次セクションの手順をユーザー側で実施推奨**。

## 3. 変更したファイル一覧

新規追加（15ファイル）:

- `supabase/config.toml`
- `supabase/migrations/20260504000001_extensions.sql`
- `supabase/migrations/20260504000002_enums.sql`
- `supabase/migrations/20260504000003_profiles.sql`
- `supabase/migrations/20260504000004_customers_children.sql`
- `supabase/migrations/20260504000005_instructors.sql`
- `supabase/migrations/20260504000006_tickets.sql`
- `supabase/migrations/20260504000007_cancel_policies.sql`
- `supabase/migrations/20260504000008_reservations.sql`
- `supabase/migrations/20260504000009_messages.sql`
- `supabase/migrations/20260504000010_notifications.sql`
- `supabase/migrations/20260504000011_payouts.sql`
- `supabase/migrations/20260504000012_functions_triggers.sql`
- `supabase/migrations/20260504000013_rls_policies.sql`
- `supabase/seed.sql`

更新（1ファイル）:

- `src/types/database.ts` (Phase 0 のプレースホルダーから本番相当の型定義に上書き)

## 4. 未実装の内容

Phase 1 のスコープ外（後続フェーズ）：

- 認証フロー本体（Phase 2）：Google SSO / LINE Login のハンドラ、招待トークン発行・検証
- ロール別 middleware の本実装（Phase 2）
- 各テーブル CRUD UI（Phase 3 以降）
- pg_cron 設定：チケット期限切れの自動 sweep は `fn_sweep_expired_tickets()` 関数のみ作成。Vercel Cron からの呼び出しは Phase 13 で実装

意図的に保留：

- インボイス番号のチェック制約に T+13桁を入れたが、実際のフォーマットは国税庁公式仕様に合わせる必要あり（再確認推奨）
- メッセージ本文の長さ上限は未設定。Phase 10 で text → varchar(2000) などに変更を検討

## 5. ローカル動作確認手順

```bash
cd kizashi

# 1. Supabase CLI のインストール (Mac/Linux)
brew install supabase/tap/supabase
# または
npm install -D supabase

# 2. Docker Desktop を起動

# 3. Supabase ローカル起動 (初回 5分程度)
supabase start

# Studio: http://localhost:54323
# DB:     postgresql://postgres:postgres@localhost:54322/postgres
# API:    http://localhost:54321

# 4. マイグレーション + seed の適用
supabase db reset

# 5. TypeScript 型の自動生成（database.ts を上書き）
pnpm gen:types

# 6. テーブル一覧の確認 (psql)
psql postgresql://postgres:postgres@localhost:54322/postgres \
     -c "select tablename from pg_tables where schemaname='public' order by tablename;"

# 期待: 27 テーブルが返る

# 7. RLS の確認
psql postgresql://postgres:postgres@localhost:54322/postgres \
     -c "select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;"

# 期待: 全テーブルで rowsecurity=t

# 8. EXCLUDE 制約の動作確認
psql postgresql://postgres:postgres@localhost:54322/postgres << 'SQL'
-- 同一講師の重なる時間に2件登録 → 2件目で失敗するはず
begin;
insert into public.reservations (
    customer_id, child_id, instructor_id, category,
    start_at, end_at, duration_min, status
) values (
    '00000000-0000-0000-0000-000000000098',
    '00000000-0000-0000-0000-000000000097',
    '00000000-0000-0000-0000-000000000099',
    'learning',
    '2026-06-01 10:00+09', '2026-06-01 11:00+09', 60, 'confirmed'
);
insert into public.reservations (
    customer_id, child_id, instructor_id, category,
    start_at, end_at, duration_min, status
) values (
    '00000000-0000-0000-0000-000000000098',
    '00000000-0000-0000-0000-000000000097',
    '00000000-0000-0000-0000-000000000099',
    'learning',
    '2026-06-01 10:30+09', '2026-06-01 11:30+09', 60, 'confirmed'
);
-- 2件目で error: conflicting key value violates exclusion constraint
rollback;
SQL

# 9. seed データの確認
psql postgresql://postgres:postgres@localhost:54322/postgres \
     -c "select count(*) as profiles from public.profiles; select count(*) as instructors from public.instructors; select count(*) as tickets from public.tickets;"

# 期待: profiles=3, instructors=1, tickets=4
```

## 6. 次に実装すべき内容（Phase 2: 認証 / ロール制御）

Phase 2 では以下を実装する：

### 2.1 認証フロー

- `src/lib/supabase/server.ts` の `createSupabaseServerClient()` を完成
- `src/lib/auth/index.ts` の `getCurrentUser()` `requireRole()` を完成
- middleware.ts でロール別ルーティングガードを実装

### 2.2 顧客 SSO (F001)

- Google ログイン: Supabase Auth の `signInWithOAuth({ provider: 'google' })`
- LINE Login: 独自 OAuth フロー
  - `/api/auth/line/start` → LINE 認可 URL 生成
  - `/api/auth/line/callback` → トークン交換 → 顧客情報取得 → Supabase Auth Admin で signInWithIdToken
  - `customers.line_user_id` に LINE sub を保存
- ログイン後ロール別リダイレクト (`/admin` / `/instructor` / `/mypage`)

### 2.3 講師招待 (F002)

- 管理者画面から講師基本情報を登録 → admin 権限で profiles + instructors + auth.users を service_role 経由で作成
- 招待トークン (HMAC + 期限付き) 生成
- メール送信（Resend API）
- 講師がトークンで初回ログイン → プロフィール完成 → status を invited → active

### 2.4 ログアウト (F004)

- Supabase Auth の signOut + cookies クリア

### 2.5 セッション維持

- middleware で `cookieStore.getAll()` / `setAll()` を実装

## 7. リスク・注意事項

### Phase 2 への引き継ぎリスク

1. **`fn_handle_new_user` トリガーは Supabase 環境のみで動く**
   - auth.users への INSERT トリガーは Supabase ローカル / 本番でしか発火しない
   - テスト時は service_role で auth.admin.createUser() を呼ぶこと

2. **LINE Login のためのカスタム OAuth**
   - Supabase Auth は LINE プロバイダー未サポート
   - 設計通り `/api/auth/line/callback` で受け、Supabase Auth Admin API で signInWithIdToken または signInAnonymously + メタデータ更新で実装する想定

3. **インボイス番号の正規表現**
   - 現在 `^T[0-9]{13}$` で固定。実際の国税庁仕様変更時は migration で変更

4. **RLS のテストカバレッジ**
   - Phase 14 で各ロールでの SELECT/INSERT 試行を E2E でカバーすべき
   - 特に「顧客 A が顧客 B のリソースを読めない」は TC005 で必須テスト

### 既知のトレードオフ

- **`addresses` の動的 FK**: `owner_type` × `owner_id` の組合せで参照先が変わる。トリガーで担保しているが、CASCADE 削除は手動実装が必要
- **`children` の重複制約**: 同一保護者内でも同名の双子が登録できないため、kana を変えて区別するルールを UI で説明する必要あり
- **EXCLUDE 制約のメンテナンス**: btree_gist 拡張がアンインストールされると制約が壊れる。本番運用時は拡張のバージョン管理を意識する

---

Phase 1 完了。実装方針通り、設計書 04_DB_RLS設計 の全要件を満たすスキーマが構築できた。
QA 回答（Q001/Q003/Q009/Q011/Q013/Q018/Q022/Q023/Q024）も全て反映済み。
