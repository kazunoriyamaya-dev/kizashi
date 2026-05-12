-- =====================================================
-- customers テーブル
-- 顧客（保護者）。ログイン主体は保護者で、子供は children に持つ (Q001)
-- =====================================================

create table public.customers (
    id            uuid        primary key default gen_random_uuid(),
    profile_id    uuid        not null unique references public.profiles(id) on delete cascade,
    parent_name   text        not null,
    parent_kana   text,
    line_user_id  text,
    google_sub    text,
    primary_address_id uuid   references public.addresses(id) on delete set null,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index customers_profile_idx       on public.customers (profile_id);
create unique index customers_line_uid_uniq on public.customers (line_user_id) where line_user_id is not null;
create unique index customers_google_sub_uniq on public.customers (google_sub) where google_sub is not null;

comment on table  public.customers              is '顧客（保護者単位）。配下に複数 children を持つ';
comment on column public.customers.line_user_id is 'LINE Login の sub (uniq)';
comment on column public.customers.google_sub   is 'Google OAuth の sub (uniq)';

-- =====================================================
-- children テーブル
-- 子供。体験予約の重複判定キー（名前 + フリガナ + 生年月日）
-- (Q003: 完全一致 + 管理者確認 / Q019: 個人情報は最小限)
-- =====================================================

create table public.children (
    id            uuid        primary key default gen_random_uuid(),
    customer_id   uuid        not null references public.customers(id) on delete cascade,
    name          text        not null,
    kana          text        not null,
    birth_date    date        not null,
    trial_used    boolean     not null default false,
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index children_customer_idx       on public.children (customer_id);
-- 体験重複判定の高速化用 (Q003)
create index children_trial_lookup_idx   on public.children (lower(name), lower(kana), birth_date);

comment on table  public.children            is '子供。体験予約は名前+カナ+生年月日の完全一致で重複判定 (Q003)';
comment on column public.children.trial_used is '体験予約利用済みフラグ (Q002: 期限なし)';

-- 子供は同一保護者内で 名前+カナ+生年月日 が重複しないようにする
-- (兄弟姉妹で完全に同じ情報の登録を防ぐ。同名同生年月日の双子は kana を変えて区別)
create unique index children_uniq_in_customer
    on public.children (customer_id, lower(name), lower(kana), birth_date);

-- =====================================================
-- addresses.owner_id の参照整合性ガード
-- 動的 FK は仕組み上不可能なため、トリガーで担保
-- =====================================================

create or replace function public.fn_validate_address_owner()
returns trigger
language plpgsql
as $$
begin
    if new.owner_type = 'customer' then
        if not exists (select 1 from public.customers where id = new.owner_id) then
            raise exception 'address.owner_id (customer) % does not exist', new.owner_id;
        end if;
    elsif new.owner_type = 'instructor' then
        -- instructors テーブルは後続マイグレーションで作成されるため、存在チェックは動的に行う
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'instructors') then
            if not exists (select 1 from public.instructors where id = new.owner_id) then
                raise exception 'address.owner_id (instructor) % does not exist', new.owner_id;
            end if;
        end if;
    elsif new.owner_type = 'reservation_location' then
        if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'reservations') then
            if not exists (select 1 from public.reservations where id = new.owner_id) then
                raise exception 'address.owner_id (reservation_location) % does not exist', new.owner_id;
            end if;
        end if;
    end if;
    return new;
end;
$$;

create trigger trg_validate_address_owner
before insert or update of owner_type, owner_id
on public.addresses
for each row execute function public.fn_validate_address_owner();
