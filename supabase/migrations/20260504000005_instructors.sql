-- =====================================================
-- instructors テーブル
-- 講師。本名・住所・連絡先は非公開、ニックネーム・顔写真のみ公開 (Q018)
-- ランクは指名料に紐づく (Q023)
-- =====================================================

create table public.instructors (
    id                    uuid                       primary key default gen_random_uuid(),
    profile_id            uuid                       not null unique references public.profiles(id) on delete cascade,

    -- 本名（非公開）
    real_name             text                       not null,
    real_name_kana        text                       not null,

    -- 公開プロフィール
    nickname              text                       not null,
    avatar_url            text,
    public_bio            text,

    -- 対応カテゴリ・ジャンル
    categories            public.category[]          not null default '{}',
    genres                text[]                     not null default '{}',

    -- 移動・自宅住所
    transportation_mode   public.transportation_mode not null default 'train',
    base_address_id       uuid                       references public.addresses(id) on delete restrict,

    -- ランク（指名料に紐づく Q023）
    rank                  public.instructor_rank     not null default 'regular',

    -- 体験自動割当の優先度（Q004）
    priority              integer                    not null default 0,

    -- ステータス（招待→アクティブ→停止/削除）
    status                public.profile_status      not null default 'invited',

    -- 連絡先（管理者のみ閲覧）
    contact_email         extensions.citext,
    contact_phone         text,

    created_at            timestamptz                not null default now(),
    updated_at            timestamptz                not null default now()
);

create index instructors_status_idx        on public.instructors (status);
create index instructors_rank_idx          on public.instructors (rank);
create index instructors_categories_idx    on public.instructors using gin (categories);
create index instructors_genres_idx        on public.instructors using gin (genres);
create unique index instructors_nickname_uniq on public.instructors (nickname) where status <> 'deleted';

comment on table  public.instructors                      is '講師。公開プロフィール (nickname/avatar/bio) と非公開情報 (real_name/contact/address) を分離 (Q018)';
comment on column public.instructors.rank                 is 'gold/silver/bronze/regular。指名料に紐づく (Q023)';
comment on column public.instructors.priority             is '体験自動割当の優先度 (Q004)。値が大きいほど優先';
comment on column public.instructors.transportation_mode  is 'train/car。交通費計算ロジックに使用';

-- =====================================================
-- 公開講師ビュー（顧客が閲覧可能な列のみ）
-- =====================================================
create view public.instructors_public as
select
    id,
    nickname,
    avatar_url,
    public_bio,
    categories,
    genres,
    rank,
    status
from public.instructors
where status = 'active';

comment on view public.instructors_public is '顧客閲覧用の講師公開ビュー。本名・住所・連絡先を含まない';

-- =====================================================
-- calendar_connections テーブル
-- 講師の Google Calendar OAuth トークン保存
-- アクセストークン・リフレッシュトークンは AES-GCM 暗号化済み (lib/encryption)
-- =====================================================

create table public.calendar_connections (
    id                       uuid        primary key default gen_random_uuid(),
    instructor_id            uuid        not null unique references public.instructors(id) on delete cascade,
    google_account_email     extensions.citext      not null,
    access_token_encrypted   text        not null,
    refresh_token_encrypted  text        not null,
    expires_at               timestamptz not null,
    scope                    text,
    last_synced_at           timestamptz,
    sync_failures            integer     not null default 0,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);

create index calendar_connections_instructor_idx on public.calendar_connections (instructor_id);

comment on table public.calendar_connections is 'Google Calendar OAuth 連携。トークンは AES-GCM 暗号化必須 (SEC006)';

-- =====================================================
-- stripe_connect_accounts テーブル
-- 講師への支払い用 (Q011: Stripe Connect Express)
-- =====================================================

create table public.stripe_connect_accounts (
    id                  uuid        primary key default gen_random_uuid(),
    instructor_id       uuid        not null unique references public.instructors(id) on delete cascade,
    stripe_account_id   text        not null unique,
    onboarding_completed boolean    not null default false,
    charges_enabled     boolean     not null default false,
    payouts_enabled     boolean     not null default false,
    requirements        jsonb,
    last_synced_at      timestamptz,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index stripe_connect_accounts_instructor_idx on public.stripe_connect_accounts (instructor_id);

comment on table public.stripe_connect_accounts is 'Stripe Connect Express 講師アカウント (Q011)';

-- =====================================================
-- invoice_settings テーブル
-- 講師のインボイス登録番号 (Q012: 業務委託費、登録ありの場合のみ番号を保持)
-- =====================================================

create table public.invoice_settings (
    id                       uuid        primary key default gen_random_uuid(),
    instructor_id            uuid        not null unique references public.instructors(id) on delete cascade,
    invoice_registration_no  text,
    registered_at            date,
    notes                    text,
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now()
);

-- インボイス番号は T で始まる13桁
alter table public.invoice_settings
    add constraint invoice_no_format check (
        invoice_registration_no is null or invoice_registration_no ~ '^T[0-9]{13}$'
    );

comment on table public.invoice_settings is 'インボイス登録番号 (Q012: 講師業務委託費、登録ありなら番号必須)';
