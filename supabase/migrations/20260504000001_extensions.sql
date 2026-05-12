-- =====================================================
-- 拡張機能の有効化
-- =====================================================
-- pgcrypto    : gen_random_uuid() / digest()
-- btree_gist  : reservations の EXCLUDE 制約 (instructor_id WITH =, tstzrange WITH &&) で必須
-- citext      : email 等の大文字小文字を区別しない比較
-- pg_trgm     : 顧客検索・講師検索の部分一致用 (Phase 3 以降)
-- =====================================================

create extension if not exists "pgcrypto"   with schema extensions;
create extension if not exists "btree_gist" with schema extensions;
create extension if not exists "citext"     with schema extensions;
create extension if not exists "pg_trgm"    with schema extensions;
