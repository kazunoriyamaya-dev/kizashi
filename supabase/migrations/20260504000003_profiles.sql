-- =====================================================
-- profiles テーブル
-- auth.users と 1:1 で紐づく。ログイン主体（保護者/講師/管理者）の共通情報
-- 設計書 04_DB_RLS設計
-- =====================================================

create table public.profiles (
    id           uuid        primary key references auth.users(id) on delete cascade,
    role         public.role         not null default 'customer',
    email        extensions.citext              not null,
    display_name text                not null,
    phone        text,
    status       public.profile_status not null default 'active',
    created_at   timestamptz         not null default now(),
    updated_at   timestamptz         not null default now()
);

create unique index profiles_email_unique on public.profiles (email);
create index profiles_role_idx           on public.profiles (role);
create index profiles_status_idx         on public.profiles (status);

comment on table  public.profiles                 is 'ログインユーザーのプロフィール（auth.users と 1:1）';
comment on column public.profiles.role            is 'admin/instructor/customer';
comment on column public.profiles.status          is 'invited (招待済み未ログイン) / active / suspended / deleted (論理削除)';

-- =====================================================
-- addresses テーブル
-- 顧客 / 講師 / 予約実施場所 のいずれかに紐づく
-- =====================================================

create table public.addresses (
    id              uuid                       primary key default gen_random_uuid(),
    owner_type      public.address_owner_type  not null,
    owner_id        uuid                       not null,
    label           text,
    postal_code     text,
    prefecture      text,
    city            text,
    address_line    text                       not null,
    building        text,
    geo_lat         numeric(9, 6),
    geo_lng         numeric(9, 6),
    created_at      timestamptz                not null default now(),
    updated_at      timestamptz                not null default now()
);

create index addresses_owner_idx on public.addresses (owner_type, owner_id);

comment on table  public.addresses              is '住所（顧客/講師/予約場所）';
comment on column public.addresses.owner_type   is 'customer / instructor / reservation_location';
comment on column public.addresses.address_line is 'Google Maps 検索用の正規化住所';
