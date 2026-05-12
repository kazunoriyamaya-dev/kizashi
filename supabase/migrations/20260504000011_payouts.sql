-- =====================================================
-- payouts テーブル
-- 講師精算（月末締め、翌月末払い）
-- Q010: Stripe手数料は実額（balance_transaction）
-- Q011: Stripe Connect で支払い
-- 計算式: (チケット消化売上 - Stripe手数料) × 50% + 指名料 + 交通費
-- =====================================================

create table public.payouts (
    id                       uuid                  primary key default gen_random_uuid(),
    instructor_id            uuid                  not null references public.instructors(id) on delete restrict,

    -- 対象月（その月の1日を保持）
    period_month             date                  not null,

    -- 集計値
    gross_amount             integer               not null default 0,  -- 売上総額（チケット按分後）
    stripe_fee_amount        integer               not null default 0,  -- 控除した Stripe 手数料
    designation_fee_amount   integer               not null default 0,  -- 指名料合計 (Q023)
    travel_fee_amount        integer               not null default 0,  -- 交通費合計
    instructor_amount        integer               not null default 0,  -- 講師支払い額（最終）
    detail                   jsonb                 not null default '{}'::jsonb,

    -- ステータス
    status                   public.payout_status  not null default 'draft',
    confirmed_at             timestamptz,
    paid_at                  timestamptz,

    -- Stripe Connect 振込
    stripe_transfer_id       text,
    stripe_payout_id         text,

    -- インボイス情報（その時点の登録番号をスナップショット）
    invoice_registration_no  text,

    created_at               timestamptz           not null default now(),
    updated_at               timestamptz           not null default now()
);

alter table public.payouts
    add constraint po_period_month_first_day check (period_month = date_trunc('month', period_month)::date),
    add constraint po_amount_nonneg          check (instructor_amount >= 0);

create unique index po_instructor_period_uniq on public.payouts (instructor_id, period_month);
create index po_status_idx                  on public.payouts (status);

comment on table public.payouts is '講師精算 (F018)。月末締め、翌月末払い (Q011 Stripe Connect)';

-- =====================================================
-- audit_logs テーブル
-- 重要操作の監査ログ (SEC005)
-- INSERT のみ、UPDATE/DELETE 不可（運用面で改ざん防止）
-- =====================================================
create table public.audit_logs (
    id                  uuid        primary key default gen_random_uuid(),
    actor_profile_id    uuid        references public.profiles(id) on delete set null,
    actor_role          public.role,
    action              text        not null,
    target_table        text        not null,
    target_id           uuid,
    before_data         jsonb,
    after_data          jsonb,
    ip_hash             text,
    user_agent          text,
    note                text,
    created_at          timestamptz not null default now()
);

create index al_actor_idx       on public.audit_logs (actor_profile_id);
create index al_target_idx      on public.audit_logs (target_table, target_id);
create index al_action_idx      on public.audit_logs (action);
create index al_created_idx     on public.audit_logs (created_at desc);

comment on table public.audit_logs is '監査ログ (SEC005)。INSERT のみ許可。改ざん防止';

-- =====================================================
-- system_settings テーブル
-- 単一行で各種設定をJSONB保持。指名料/通知設定/その他のシステム設定
-- Q023の指名料、Q022の通知タイミング等を集中管理
-- =====================================================
create table public.system_settings (
    id                          uuid        primary key default gen_random_uuid(),
    -- 単一行を強制するための固定値カラム（unique制約付き）
    singleton_lock              integer     not null default 1,
    -- Q023: 指名料 { gold: 1500, silver: 1000, bronze: 500, regular: 0 }
    instructor_designation_fees jsonb       not null default '{"gold":1500,"silver":1000,"bronze":500,"regular":0}'::jsonb,
    -- Q022: チケット期限切れ通知タイミング (日数の配列)
    ticket_expiry_notify_days   integer[]   not null default '{30,14,7,1}',
    -- Q005: 予約受付時間と先行日数
    reservation_window_days     integer     not null default 30,
    reservation_open_hour       integer     not null default 9,
    reservation_close_hour      integer     not null default 23,
    -- Q005: 対面前後バッファ (分)
    onsite_buffer_minutes       integer     not null default 60,
    online_buffer_minutes       integer     not null default 0,
    -- 車交通費 単価（円/km）
    car_fare_per_km             integer     not null default 30,
    -- 体験予約: 重複検知時の処理 ('require_review' | 'auto_reject' | 'auto_approve')
    trial_duplicate_action      text        not null default 'require_review',
    -- メッセージ監査の利用規約明記済みフラグ (Q015)
    message_audit_disclosed     boolean     not null default false,
    -- 講師招待トークン有効時間 (Hour)
    invite_token_ttl_hours      integer     not null default 72,
    -- 任意拡張設定
    extras                      jsonb       not null default '{}'::jsonb,
    updated_by                  uuid        references public.profiles(id) on delete set null,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz not null default now()
);

-- singleton: 1行のみを許可
create unique index ss_singleton_idx on public.system_settings (singleton_lock);

alter table public.system_settings
    add constraint ss_singleton_one     check (singleton_lock = 1),
    add constraint ss_trial_dup_action_chk
        check (trial_duplicate_action in ('require_review', 'auto_reject', 'auto_approve')),
    add constraint ss_window_pos    check (reservation_window_days > 0),
    add constraint ss_open_hour_chk check (reservation_open_hour between 0 and 23),
    add constraint ss_close_hour_chk check (reservation_close_hour between 1 and 24),
    add constraint ss_hours_order   check (reservation_close_hour > reservation_open_hour),
    add constraint ss_invite_ttl_pos check (invite_token_ttl_hours > 0);

comment on table  public.system_settings                       is 'システム共通設定 (singleton)';
comment on column public.system_settings.instructor_designation_fees is 'Q023 講師ランク別指名料';
comment on column public.system_settings.ticket_expiry_notify_days   is 'Q022 期限切れ通知タイミング (日)';
