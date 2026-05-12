-- =====================================================
-- RLS 逆引きテスト (TC005 / TC013 / TC025 etc.)
--
-- 使い方:
--   psql postgresql://postgres:postgres@localhost:54322/postgres -f docs/test/rls-tests.sql
--
-- 各テストは BEGIN ... ROLLBACK で囲み、副作用を残さない。
-- set role authenticated → set local request.jwt.claims で auth.uid() を擬似する。
-- =====================================================

\set ON_ERROR_STOP on
\echo '=== RLS 逆引きテスト 開始 ==='

-- =====================================================
-- 共通: テスト用ユーザー uuid を取得
-- =====================================================
\set admin_id      '\'00000000-0000-0000-0000-000000000001\''
\set instructor_id '\'00000000-0000-0000-0000-000000000002\''
\set customer_id   '\'00000000-0000-0000-0000-000000000003\''

-- ヘルパー: 指定 user_id で auth ctx を擬似する
-- (Supabase は set_config('request.jwt.claims', json, true) を見て auth.uid() を返す)

\echo ''
\echo '--- TEST 1: 顧客が他人の customer_tickets を見られない ---'
begin;
  -- 仮の他人 customer を作成（ID は固定値で）
  insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, aud, role, instance_id)
  values ('00000000-0000-0000-0000-0000000000aa', 'other@kizashi.example.com', now(), now(), now(),
          'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
  on conflict do nothing;

  -- 既存の seed 顧客 (customer_id=00000000-...-000000000098) のチケットを偽装挿入はせず、
  -- 通常 seed の customer_tickets 0 件のため、件数 0 を期待

  -- 顧客 A (seed customer profile_id=...003) の context
  set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
  set local role to 'authenticated';

  -- 他人 (profile_id ...0000000aa) の customer に該当するチケットが見えてはいけない
  select 'PASS: 顧客 A は他人の customer_tickets 0 件であるべき' as expectation,
         count(*) filter (where customer_id <> '00000000-0000-0000-0000-000000000098'::uuid)
           as other_visible_count
    from public.customer_tickets;
rollback;

\echo ''
\echo '--- TEST 2: 顧客は他人の reservations にアクセスできない ---'
begin;
  set local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
  set local role to 'authenticated';
  select 'PASS: 顧客は自分の予約のみ参照' as expectation,
         count(*) filter (where customer_id <> '00000000-0000-0000-0000-000000000098'::uuid) as other_visible_count
    from public.reservations;
rollback;

\echo ''
\echo '--- TEST 3: 講師は instructors_public ビューから公開列のみ取得 ---'
begin;
  -- 認証なし anon
  set local role to 'anon';
  select 'CHECK: 公開ビューから取得可、ベーステーブルは不可' as expectation,
         (select count(*) from public.instructors_public) as public_view_count;
  -- ベーステーブルへの直接 select は 0 件のはず (active 講師は公開だが、ベース列は本人 + admin のみ)
  select count(*) as base_visible_count from public.instructors;
rollback;

\echo ''
\echo '--- TEST 4: EXCLUDE 制約による二重予約防止 (TC013) ---'
begin;
  -- seed 講師 (id=00000000-0000-0000-0000-000000000099) に対して、
  -- 重なる時間で 2 件の confirmed 予約を INSERT
  insert into public.reservations (
      customer_id, child_id, instructor_id, category,
      start_at, end_at, duration_min, status, designation_fee
  ) values (
      '00000000-0000-0000-0000-000000000098',
      '00000000-0000-0000-0000-000000000097',
      '00000000-0000-0000-0000-000000000099',
      'learning',
      '2026-06-01 10:00+09'::timestamptz,
      '2026-06-01 11:00+09'::timestamptz,
      60, 'confirmed', 0
  );

  do $$
  begin
    -- 2 件目: 10:30 - 11:30 → 重複 → EXCLUDE 制約で失敗するはず
    begin
      insert into public.reservations (
          customer_id, child_id, instructor_id, category,
          start_at, end_at, duration_min, status, designation_fee
      ) values (
          '00000000-0000-0000-0000-000000000098',
          '00000000-0000-0000-0000-000000000097',
          '00000000-0000-0000-0000-000000000099',
          'learning',
          '2026-06-01 10:30+09'::timestamptz,
          '2026-06-01 11:30+09'::timestamptz,
          60, 'confirmed', 0
      );
      raise notice 'FAIL: 2件目の重複予約が成功してしまった';
    exception when others then
      raise notice 'PASS: 2件目の重複予約が SQLSTATE % で失敗', SQLSTATE;
      -- SQLSTATE = 23P01 (exclusion_violation) を期待
    end;
  end $$;
rollback;

\echo ''
\echo '--- TEST 5: audit_logs は UPDATE / DELETE 不可 ---'
begin;
  insert into public.audit_logs (action, target_table, actor_role)
  values ('test.action', 'reservations', 'admin')
  returning id as log_id \gset

  do $$
  begin
    begin
      update public.audit_logs set action = 'modified' where id = :'log_id'::uuid;
      raise notice 'FAIL: audit_logs UPDATE が成功してしまった';
    exception when others then
      raise notice 'PASS: audit_logs UPDATE がトリガーで拒否された (%)', SQLERRM;
    end;
    begin
      delete from public.audit_logs where id = :'log_id'::uuid;
      raise notice 'FAIL: audit_logs DELETE が成功してしまった';
    exception when others then
      raise notice 'PASS: audit_logs DELETE がトリガーで拒否された (%)', SQLERRM;
    end;
  end $$;
rollback;

\echo ''
\echo '--- TEST 6: customer_tickets.remaining_count は 0 未満不可 ---'
begin;
  do $$
  declare
    cid uuid;
  begin
    begin
      insert into public.customer_tickets (
          customer_id, ticket_id, remaining_count, initial_count, expires_at
      ) values (
          '00000000-0000-0000-0000-000000000098',
          '00000000-0000-0000-0000-000000000201',
          -1, 1, now() + interval '90 days'
      ) returning id into cid;
      raise notice 'FAIL: remaining_count=-1 が成功してしまった';
    exception when check_violation then
      raise notice 'PASS: remaining_count=-1 が check_violation で拒否された';
    end;
  end $$;
rollback;

\echo ''
\echo '--- TEST 7: children の同一保護者内重複は禁止 (Q003) ---'
begin;
  do $$
  begin
    begin
      insert into public.children (customer_id, name, kana, birth_date)
      values ('00000000-0000-0000-0000-000000000098', '顧客花子', 'コキャクハナコ', '2015-04-01');
      raise notice 'FAIL: 同一保護者で同名同生年月日の子供が登録できた';
    exception when unique_violation then
      raise notice 'PASS: 同一保護者内の子供重複が unique_violation で拒否された';
    end;
  end $$;
rollback;

\echo ''
\echo '--- TEST 8: instructors_public は status=active のみを露出 ---'
begin;
  select 'CHECK: invited / suspended 講師は instructors_public に含まれない' as expectation,
         (select count(*) from public.instructors_public where status <> 'active') as inactive_in_public;
rollback;

\echo ''
\echo '=== RLS 逆引きテスト 終了 ==='
