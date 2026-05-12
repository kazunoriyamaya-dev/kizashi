-- =====================================================
-- tickets テーブル
-- チケット商品（管理者がCRUD）
-- Q005: duration_min で60/90分を切り替え
-- Q001: lesson_format で solo/pair を切り替え
-- Q023: 共通チケットを基本とする (category=NULL or 全カテゴリ可)
-- =====================================================

create table public.tickets (
    id              uuid                  primary key default gen_random_uuid(),
    name            text                  not null,
    description     text,

    -- カテゴリ（NULL のときは共通チケット = 全カテゴリで使用可能）
    category        public.category,

    -- 価格と回数
    price           integer               not null,
    session_count   integer               not null,
    valid_days      integer               not null,

    -- レッスン仕様
    duration_min    integer               not null default 60,
    lesson_format   public.lesson_format  not null default 'solo',

    -- Stripe 連携
    stripe_product_id  text,
    stripe_price_id    text,

    -- 表示順・ステータス
    sort_order      integer               not null default 0,
    status          public.ticket_status  not null default 'active',

    created_at      timestamptz           not null default now(),
    updated_at      timestamptz           not null default now()
);

alter table public.tickets
    add constraint tickets_price_positive    check (price >= 0),
    add constraint tickets_sessions_positive check (session_count >= 1),
    add constraint tickets_valid_positive    check (valid_days >= 1),
    add constraint tickets_duration_valid    check (duration_min in (30, 45, 60, 90, 120));

create index tickets_status_idx     on public.tickets (status);
create index tickets_category_idx   on public.tickets (category);
create index tickets_lesson_fmt_idx on public.tickets (lesson_format);

comment on table  public.tickets               is 'チケット商品マスタ。管理者管理 (F015)';
comment on column public.tickets.category      is 'NULL = 共通チケット (Q023)';
comment on column public.tickets.lesson_format is 'solo = 1名、pair = ペア (Q001)';
comment on column public.tickets.duration_min  is 'レッスン時間（分） (Q005: 60/90)';

-- =====================================================
-- customer_tickets テーブル
-- 顧客（保護者）が保有するチケット。残数管理。
-- 兄弟姉妹間でチケット共有可 (Q024) ＝ customer_id 単位で保有
-- =====================================================

create table public.customer_tickets (
    id                uuid                          primary key default gen_random_uuid(),
    customer_id       uuid                          not null references public.customers(id) on delete restrict,
    ticket_id         uuid                          not null references public.tickets(id)  on delete restrict,
    payment_id        uuid,                         -- payments テーブル作成後に FK 追加
    remaining_count   integer                       not null,
    initial_count     integer                       not null,
    purchased_at      timestamptz                   not null default now(),
    expires_at        timestamptz                   not null,
    status            public.customer_ticket_status not null default 'active',
    notes             text,
    created_at        timestamptz                   not null default now(),
    updated_at        timestamptz                   not null default now()
);

alter table public.customer_tickets
    add constraint ct_remaining_nonneg  check (remaining_count >= 0),
    add constraint ct_initial_positive  check (initial_count >= 1),
    add constraint ct_remaining_le_init check (remaining_count <= initial_count);

create index ct_customer_idx           on public.customer_tickets (customer_id);
create index ct_ticket_idx             on public.customer_tickets (ticket_id);
create index ct_status_idx             on public.customer_tickets (status);
create index ct_expires_idx            on public.customer_tickets (expires_at);
-- 残数あり&未失効&アクティブの予約消化対象を高速取得
create index ct_active_available_idx
    on public.customer_tickets (customer_id, expires_at)
    where status = 'active' and remaining_count > 0;

comment on table  public.customer_tickets                is '顧客保有チケット。残数 / 有効期限 / ステータス管理 (Q024 家族共有)';
comment on column public.customer_tickets.remaining_count is '残回数。0 になったら status=used に状態遷移';

-- =====================================================
-- payments テーブル
-- Stripe 決済記録。webhook 経由でのみ更新 (TC009/TC010)
-- =====================================================

create table public.payments (
    id                          uuid                   primary key default gen_random_uuid(),
    customer_id                 uuid                   not null references public.customers(id) on delete restrict,
    ticket_id                   uuid                   references public.tickets(id) on delete set null,

    -- Stripe IDs
    stripe_session_id           text                   not null unique,
    stripe_payment_intent_id    text,
    stripe_charge_id            text,

    -- 金額
    amount                      integer                not null,
    currency                    text                   not null default 'jpy',
    stripe_fee                  integer,
    net_amount                  integer,

    -- ステータス
    status                      public.payment_status  not null default 'pending',

    -- 関連情報
    metadata                    jsonb                  not null default '{}'::jsonb,
    refunded_amount             integer                not null default 0,
    refunded_at                 timestamptz,

    created_at                  timestamptz            not null default now(),
    updated_at                  timestamptz            not null default now()
);

alter table public.payments
    add constraint payments_amount_positive   check (amount >= 0),
    add constraint payments_refund_le_amount  check (refunded_amount >= 0 and refunded_amount <= amount);

create index payments_customer_idx on public.payments (customer_id);
create index payments_status_idx   on public.payments (status);
create index payments_created_idx  on public.payments (created_at desc);

comment on table public.payments is 'Stripe 決済記録。INSERT/UPDATE は webhook サーバー処理のみ (RLS)';

-- customer_tickets.payment_id の FK を ここで追加
alter table public.customer_tickets
    add constraint ct_payment_fk foreign key (payment_id) references public.payments(id) on delete set null;

-- =====================================================
-- stripe_webhook_events テーブル
-- Webhook の冪等性管理 (API021/TC010)
-- =====================================================

create table public.stripe_webhook_events (
    id              uuid        primary key default gen_random_uuid(),
    event_id        text        not null unique,
    event_type      text        not null,
    livemode        boolean     not null default false,
    api_version     text,
    received_at     timestamptz not null default now(),
    processed_at    timestamptz,
    payload         jsonb       not null,
    error_message   text
);

create index swe_event_type_idx on public.stripe_webhook_events (event_type);
create index swe_processed_idx  on public.stripe_webhook_events (processed_at);

comment on table  public.stripe_webhook_events          is 'Stripe webhook 受信ログ。event_id UNIQUE で冪等性を保証 (TC010)';
comment on column public.stripe_webhook_events.event_id is 'Stripe Event オブジェクトの ID';
