-- =====================================================
-- 共通ユーティリティ関数 + トリガー
-- =====================================================

-- ===== updated_at 自動更新トリガー関数 =====
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

-- updated_at を持つテーブルに一括でトリガーを張る
do $$
declare
    rec record;
begin
    for rec in
        select table_name
        from information_schema.columns
        where table_schema = 'public'
          and column_name = 'updated_at'
          and table_name not like 'pg_%'
    loop
        execute format(
            'drop trigger if exists trg_%1$s_updated_at on public.%1$I',
            rec.table_name
        );
        execute format(
            'create trigger trg_%1$s_updated_at
                before update on public.%1$I
                for each row execute function public.fn_set_updated_at()',
            rec.table_name
        );
    end loop;
end$$;

-- =====================================================
-- 認証コンテキストのヘルパー関数
-- RLS ポリシーから呼び出す
-- =====================================================

create or replace function public.fn_current_role()
returns public.role
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid()
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.fn_is_instructor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'instructor' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.fn_is_customer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'customer' from public.profiles where id = auth.uid()), false)
$$;

-- 現在ログイン中の customer.id を取得（顧客ロール時のみ非NULL）
create or replace function public.fn_current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select id from public.customers where profile_id = auth.uid()
$$;

-- 現在ログイン中の instructor.id を取得（講師ロール時のみ非NULL）
create or replace function public.fn_current_instructor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select id from public.instructors where profile_id = auth.uid()
$$;

comment on function public.fn_current_role()         is 'RLSヘルパー: 現在のログインユーザーのロール';
comment on function public.fn_is_admin()             is 'RLSヘルパー: ログインユーザーが admin か';
comment on function public.fn_current_customer_id()  is 'RLSヘルパー: 現在ログイン中の customer.id (NULL=非顧客)';
comment on function public.fn_current_instructor_id() is 'RLSヘルパー: 現在ログイン中の instructor.id (NULL=非講師)';

-- =====================================================
-- audit_logs INSERT 専用ガード
-- UPDATE/DELETE は完全禁止（service role でも不可）
-- =====================================================

create or replace function public.fn_audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
    raise exception 'audit_logs は不変です: UPDATE/DELETE は許可されません';
end;
$$;

create trigger trg_audit_logs_no_update
before update on public.audit_logs
for each row execute function public.fn_audit_logs_immutable();

create trigger trg_audit_logs_no_delete
before delete on public.audit_logs
for each row execute function public.fn_audit_logs_immutable();

-- =====================================================
-- 顧客サインアップ時に customers レコードを自動作成
-- (auth.users INSERT → profiles → customers)
-- 講師は管理者が招待する流れなので、自動作成しない
-- =====================================================

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    user_role public.role;
    user_email text;
    user_name  text;
begin
    user_email := coalesce(new.email, '');
    user_name  := coalesce(
        new.raw_user_meta_data->>'name',
        new.raw_user_meta_data->>'full_name',
        split_part(user_email, '@', 1)
    );
    -- meta_data.role が指定されていればそれを使う、そうでなければ customer
    user_role := coalesce(
        nullif(new.raw_user_meta_data->>'role', '')::public.role,
        'customer'
    );

    insert into public.profiles (id, role, email, display_name)
    values (new.id, user_role, user_email::extensions.citext, user_name)
    on conflict (id) do update
        set email        = excluded.email,
            display_name = case when public.profiles.display_name is null or public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end,
            updated_at   = now();

    -- 顧客の場合は customers と children 0件状態で作成
    if user_role = 'customer' then
        insert into public.customers (profile_id, parent_name)
        values (new.id, user_name)
        on conflict (profile_id) do nothing;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function public.fn_handle_new_user();

comment on function public.fn_handle_new_user is 'Supabase Auth サインアップ時に profiles/customers を自動作成 (F001)';

-- =====================================================
-- チケット期限切れの自動状態更新
-- pg_cron は Supabase 環境で別途設定するため、ここでは関数のみ提供
-- Phase 13 で Vercel Cron から /api/cron/sweep-expired-tickets で呼び出す
-- =====================================================

create or replace function public.fn_sweep_expired_tickets()
returns table (updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
    cnt integer;
begin
    update public.customer_tickets
       set status = 'expired',
           updated_at = now()
     where status = 'active'
       and expires_at < now();
    get diagnostics cnt = row_count;
    return query select cnt;
end;
$$;

revoke execute on function public.fn_sweep_expired_tickets from public;
grant execute on function public.fn_sweep_expired_tickets to service_role;

comment on function public.fn_sweep_expired_tickets() is 'Q022: 有効期限切れチケットを expired に状態遷移 (Cron)';

-- =====================================================
-- 残数 0 のチケットを used に状態遷移
-- 予約消化トランザクションの最後に呼ぶ
-- =====================================================

create or replace function public.fn_close_used_tickets()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.customer_tickets
       set status = 'used',
           updated_at = now()
     where status = 'active'
       and remaining_count = 0;
end;
$$;

revoke execute on function public.fn_close_used_tickets() from public;
grant execute on function public.fn_close_used_tickets() to service_role;

-- =====================================================
-- 体験予約 重複判定 (Q003)
-- 子供情報の完全一致 (name + kana + birth_date) を返す
-- =====================================================

create or replace function public.fn_find_trial_duplicates(
    p_name       text,
    p_kana       text,
    p_birth_date date
)
returns table (
    child_id     uuid,
    customer_id  uuid,
    trial_used   boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select c.id as child_id, c.customer_id, c.trial_used
      from public.children c
     where lower(c.name)  = lower(p_name)
       and lower(c.kana)  = lower(p_kana)
       and c.birth_date   = p_birth_date
$$;

revoke execute on function public.fn_find_trial_duplicates(text, text, date) from public;
grant execute on function public.fn_find_trial_duplicates(text, text, date) to service_role;

comment on function public.fn_find_trial_duplicates is 'Q003: 体験予約の子供情報完全一致検出';
