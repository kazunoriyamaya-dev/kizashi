-- =====================================================
-- reservations テーブル
-- 予約。EXCLUDE制約で同一講師の時間枠重複を防止 (PERF002 / TC013)
-- Q001: ペア参加者を pair_participants (jsonb) に保存
-- Q023: 講師ランク指名料を designation_fee に保存
-- =====================================================

create table public.reservations (
    id                    uuid                       primary key default gen_random_uuid(),

    -- 関連エンティティ
    customer_id           uuid                       not null references public.customers(id) on delete restrict,
    child_id              uuid                       not null references public.children(id)  on delete restrict,
    -- 体験予約は確定時に自動割当されるため NULL 許可、確定後は NOT NULL を期待
    instructor_id         uuid                       references public.instructors(id) on delete restrict,

    -- 予約属性
    category              public.category            not null,
    reservation_type      public.reservation_type    not null default 'normal',
    start_at              timestamptz                not null,
    end_at                timestamptz                not null,
    duration_min          integer                    not null,

    -- オンライン/対面
    delivery_type         public.delivery_type       not null default 'online',
    location_address_id   uuid                       references public.addresses(id) on delete set null,

    -- ペアレッスン (Q001)
    pair_participants     jsonb                      not null default '[]'::jsonb,

    -- チケット消化
    customer_ticket_id    uuid                       references public.customer_tickets(id) on delete set null,

    -- 指名料 (Q023)
    designation_fee       integer                    not null default 0,

    -- ステータス
    status                public.reservation_status  not null default 'draft',

    -- Google 連携
    google_event_id       text,
    google_meet_url       text,

    -- 通知ログ用
    confirmed_at          timestamptz,
    cancelled_at          timestamptz,
    cancel_reason         public.cancel_reason,
    cancel_note           text,

    created_at            timestamptz                not null default now(),
    updated_at            timestamptz                not null default now()
);

-- 制約
alter table public.reservations
    add constraint rsv_time_order      check (end_at > start_at),
    add constraint rsv_duration_pos    check (duration_min > 0),
    add constraint rsv_designation_pos check (designation_fee >= 0),
    -- pair_participants は配列形式
    add constraint rsv_pair_is_array   check (jsonb_typeof(pair_participants) = 'array');

create index rsv_customer_idx          on public.reservations (customer_id);
create index rsv_instructor_idx        on public.reservations (instructor_id);
create index rsv_child_idx             on public.reservations (child_id);
create index rsv_start_idx             on public.reservations (start_at);
create index rsv_status_idx            on public.reservations (status);
create index rsv_type_idx              on public.reservations (reservation_type);
create index rsv_instructor_start_idx  on public.reservations (instructor_id, start_at)
    where status in ('confirmed', 'pending_payment', 'changed');

-- =====================================================
-- 二重予約防止 (PERF002 / TC013)
-- 同一講師×重なる時間枠×アクティブステータスは1件のみ許可
-- 要 btree_gist 拡張（拡張用マイグレーションで有効化済み）
-- =====================================================

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

comment on table  public.reservations                  is '予約。EXCLUDE制約で講師の時間重複を防ぐ (PERF002)';
comment on column public.reservations.pair_participants is 'ペアレッスン参加者 [{type:child, child_id}] or [{type:free_text, name, note}] (Q001)';
comment on column public.reservations.designation_fee  is '講師ランク別指名料 (Q023: gold 1500/silver 1000/bronze 500/regular 0)';

-- =====================================================
-- travel_fees テーブル
-- 対面予約の交通費（Q009: 車は往復 × 30円/km、小数点切り上げ）
-- =====================================================

create table public.travel_fees (
    id                      uuid                        primary key default gen_random_uuid(),
    reservation_id          uuid                        not null unique references public.reservations(id) on delete cascade,
    mode                    public.transportation_mode  not null,
    one_way_distance_km     numeric(8, 3),
    round_trip_distance_km  numeric(8, 3),
    amount                  integer                     not null default 0,

    -- 手動入力フラグ (Q008: 電車運賃取得不可時)
    is_manual               boolean                     not null default false,
    manual_reason           text,
    requires_admin_review   boolean                     not null default false,

    -- Google Maps レスポンスサマリ（個人情報除く必要最小限）
    maps_response_summary   jsonb,

    created_at              timestamptz                 not null default now(),
    updated_at              timestamptz                 not null default now()
);

alter table public.travel_fees
    add constraint tf_amount_nonneg check (amount >= 0);

create index tf_review_idx on public.travel_fees (requires_admin_review) where requires_admin_review = true;

comment on table  public.travel_fees             is '交通費 (F038)。Q009: 車は往復距離切り上げ × 30';
comment on column public.travel_fees.is_manual   is 'true = 管理者/講師による手動入力 (Q008 電車取得不可時)';

-- =====================================================
-- reservation_changes テーブル
-- 予約変更履歴 (TC018/TC025: audit_logs と併用、UI表示用に明細保持)
-- =====================================================

create table public.reservation_changes (
    id              uuid        primary key default gen_random_uuid(),
    reservation_id  uuid        not null references public.reservations(id) on delete cascade,
    actor_profile_id uuid       references public.profiles(id) on delete set null,
    change_type     text        not null,
    before_data     jsonb,
    after_data      jsonb,
    note            text,
    created_at      timestamptz not null default now()
);

create index rsv_changes_reservation_idx on public.reservation_changes (reservation_id, created_at desc);

alter table public.reservation_changes
    add constraint rsv_change_type_chk
    check (change_type in ('created', 'time_changed', 'instructor_changed', 'location_changed',
                            'cancelled', 'restored', 'completed', 'no_show'));

comment on table public.reservation_changes is '予約変更履歴 (UI表示用の明細)。完全な audit は audit_logs に保存';

-- =====================================================
-- trial_pending_reviews テーブル
-- 体験予約の管理者確認待ち (Q003: 子供情報完全一致時の管理者承認フロー)
-- =====================================================

create table public.trial_pending_reviews (
    id                  uuid                          primary key default gen_random_uuid(),
    customer_id         uuid                          not null references public.customers(id) on delete cascade,
    child_id            uuid                          not null references public.children(id)  on delete cascade,
    matched_child_id    uuid                          references public.children(id) on delete set null,
    requested_at        timestamptz                   not null default now(),
    requested_payload   jsonb                         not null,
    status              public.trial_review_status    not null default 'pending',
    reviewed_by         uuid                          references public.profiles(id) on delete set null,
    reviewed_at         timestamptz,
    review_note         text,
    -- 承認時に作成された予約の参照
    resulting_reservation_id uuid                     references public.reservations(id) on delete set null,
    created_at          timestamptz                   not null default now(),
    updated_at          timestamptz                   not null default now()
);

create index tpr_status_idx       on public.trial_pending_reviews (status, requested_at);
create index tpr_customer_idx     on public.trial_pending_reviews (customer_id);

comment on table public.trial_pending_reviews is '体験予約の管理者確認待ち (Q003)。重複疑いの判定後にここに登録';

-- =====================================================
-- google_meet_links テーブル
-- Google Meet URL 管理 (Q006: 自動発行)
-- reservations.google_meet_url にも複製するが、履歴と詳細はここで保持
-- =====================================================

create table public.google_meet_links (
    id              uuid        primary key default gen_random_uuid(),
    reservation_id  uuid        not null unique references public.reservations(id) on delete cascade,
    meet_url        text        not null,
    google_event_id text,
    issued_at       timestamptz not null default now(),
    revoked_at      timestamptz,
    created_at      timestamptz not null default now()
);

comment on table public.google_meet_links is 'Google Meet URL (Q006)。予約変更時の旧URL保持にも利用';
