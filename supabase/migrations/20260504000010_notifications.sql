-- =====================================================
-- 通知ログテーブル群
-- メール / LINE / Push の3チャネル (Q016: MVPで全て実装)
-- =====================================================

-- =====================================================
-- email_notification_logs
-- =====================================================
create table public.email_notification_logs (
    id              uuid                          primary key default gen_random_uuid(),
    target_profile_id uuid                        references public.profiles(id) on delete set null,
    to_email        extensions.citext                        not null,
    template        text                          not null,
    subject         text                          not null,
    payload         jsonb                         not null default '{}'::jsonb,
    status          public.notification_status    not null default 'queued',
    provider        text                          not null default 'resend',
    provider_id     text,
    error_message   text,
    sent_at         timestamptz,
    created_at      timestamptz                   not null default now()
);

create index enl_target_idx     on public.email_notification_logs (target_profile_id);
create index enl_status_idx     on public.email_notification_logs (status);
create index enl_template_idx   on public.email_notification_logs (template);
create index enl_created_idx    on public.email_notification_logs (created_at desc);

comment on table public.email_notification_logs is 'メール通知ログ (F039)';

-- =====================================================
-- line_notification_logs
-- =====================================================
create table public.line_notification_logs (
    id              uuid                          primary key default gen_random_uuid(),
    target_profile_id uuid                        references public.profiles(id) on delete set null,
    to_line_user_id text                          not null,
    template        text                          not null,
    payload         jsonb                         not null default '{}'::jsonb,
    status          public.notification_status    not null default 'queued',
    provider_id     text,
    error_message   text,
    sent_at         timestamptz,
    created_at      timestamptz                   not null default now()
);

create index lnl_target_idx     on public.line_notification_logs (target_profile_id);
create index lnl_status_idx     on public.line_notification_logs (status);
create index lnl_template_idx   on public.line_notification_logs (template);
create index lnl_created_idx    on public.line_notification_logs (created_at desc);

comment on table public.line_notification_logs is 'LINE Messaging API 通知ログ (Q016)';

-- =====================================================
-- push_subscriptions
-- Web Push 購読情報
-- =====================================================
create table public.push_subscriptions (
    id              uuid        primary key default gen_random_uuid(),
    profile_id      uuid        not null references public.profiles(id) on delete cascade,
    endpoint        text        not null,
    p256dh_key      text        not null,
    auth_key        text        not null,
    user_agent      text,
    created_at      timestamptz not null default now(),
    last_used_at    timestamptz,
    revoked_at      timestamptz
);

create unique index ps_endpoint_uniq on public.push_subscriptions (endpoint);
create index ps_profile_idx          on public.push_subscriptions (profile_id) where revoked_at is null;

comment on table public.push_subscriptions is 'Web Push 購読 (Q016 アプリ内通知の VAPID 配信先)';

-- =====================================================
-- push_notification_logs
-- =====================================================
create table public.push_notification_logs (
    id              uuid                          primary key default gen_random_uuid(),
    subscription_id uuid                          references public.push_subscriptions(id) on delete set null,
    target_profile_id uuid                        references public.profiles(id) on delete set null,
    template        text                          not null,
    title           text                          not null,
    body            text                          not null,
    payload         jsonb                         not null default '{}'::jsonb,
    status          public.notification_status    not null default 'queued',
    error_message   text,
    sent_at         timestamptz,
    created_at      timestamptz                   not null default now()
);

create index pnl_target_idx   on public.push_notification_logs (target_profile_id);
create index pnl_status_idx   on public.push_notification_logs (status);
create index pnl_template_idx on public.push_notification_logs (template);
create index pnl_created_idx  on public.push_notification_logs (created_at desc);

comment on table public.push_notification_logs is 'Web Push 通知ログ (Q016)';
