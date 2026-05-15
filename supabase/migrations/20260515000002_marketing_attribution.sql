-- =====================================================
-- マーケティング Attribution
--
-- 目的: 新規顧客獲得マーケの効果測定。
--   購読フォーム入力 (lead) → 体験予約 (trial) → 顧客化 (customer) → 有料化 (paid) のファネルを、
--   どの LP / 広告 / アフィリエイト / SNS から流入したかと紐付けて記録する。
--
-- 既存の customers / reservations / payments を変更しない方針:
--   - email アドレスをキーに marketing_email_subscribers と profiles を後追いで結合
--   - 体験予約 / 顧客化 / 有料化のタイムスタンプはこのテーブルに別管理
--   - 同期は cron バッチ (api/cron/marketing-dispatch) で行う
-- =====================================================

create table public.marketing_attribution (
    id                     uuid                           primary key default gen_random_uuid(),

    -- リード本体 (購読時に必ず作る)
    subscriber_id          uuid                           references public.marketing_email_subscribers(id) on delete cascade,
    email                  extensions.citext              not null,

    -- 流入源 (購読時にスナップショット)
    lead_source_kind       text                           not null default 'unknown',     -- lp / blog / affiliate / sns / ad / line / direct / referral / unknown
    landing_page_id        uuid                           references public.marketing_landing_pages(id) on delete set null,
    blog_post_id           uuid                           references public.marketing_blog_posts(id) on delete set null,
    sns_post_id            uuid                           references public.marketing_sns_posts(id) on delete set null,
    affiliate_link_id      uuid                           references public.marketing_affiliate_links(id) on delete set null,
    ad_campaign_id         uuid                           references public.marketing_ad_campaigns(id) on delete set null,
    campaign_id            uuid                           references public.marketing_campaigns(id) on delete set null,
    utm_source             text,
    utm_medium             text,
    utm_campaign           text,
    utm_content            text,
    referrer               text,

    -- ファネル各段階のタイムスタンプ
    lead_at                timestamptz                    not null default now(),     -- 購読 (フォーム送信)
    profile_id             uuid                           references public.profiles(id) on delete set null,
    profile_linked_at      timestamptz,                   -- email 一致でアカウント作成を検知
    trial_reserved_at      timestamptz,                   -- 体験予約申込 (reservations.type='trial' の最初)
    trial_completed_at     timestamptz,                   -- 体験予約完了 (reservations.status='completed' の最初)
    first_paid_at          timestamptz,                   -- 初回チケット購入 (payments.status='paid' の最初)
    first_payment_jpy      integer,                        -- 初回購入額

    notes                  text,
    created_at             timestamptz                    not null default now(),
    updated_at             timestamptz                    not null default now(),

    unique (email)
);

create index mka_email_idx          on public.marketing_attribution (email);
create index mka_profile_idx        on public.marketing_attribution (profile_id);
create index mka_source_idx         on public.marketing_attribution (lead_source_kind);
create index mka_landing_idx        on public.marketing_attribution (landing_page_id);
create index mka_blog_idx           on public.marketing_attribution (blog_post_id);
create index mka_affiliate_idx      on public.marketing_attribution (affiliate_link_id);
create index mka_ad_idx             on public.marketing_attribution (ad_campaign_id);
create index mka_campaign_idx       on public.marketing_attribution (campaign_id);
create index mka_lead_at_idx        on public.marketing_attribution (lead_at desc);
create index mka_trial_reserved_idx on public.marketing_attribution (trial_reserved_at) where trial_reserved_at is not null;
create index mka_first_paid_idx     on public.marketing_attribution (first_paid_at) where first_paid_at is not null;

comment on table public.marketing_attribution is
    'マーケ流入源 → 顧客化のアトリビューション (Phase 15)';

-- =====================================================
-- RLS: admin only
-- =====================================================
alter table public.marketing_attribution enable row level security;

create policy marketing_attribution_admin_all
    on public.marketing_attribution for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- updated_at トリガー
drop trigger if exists trg_marketing_attribution_updated_at on public.marketing_attribution;
create trigger trg_marketing_attribution_updated_at
    before update on public.marketing_attribution
    for each row execute function public.fn_set_updated_at();

-- =====================================================
-- RPC: 既存の customer / reservation / payment を email 経由で照合し、
--       attribution の各タイムスタンプを更新する。
--   Cron バッチ (marketing-dispatch) から定期実行。
-- =====================================================
create or replace function public.fn_sync_marketing_attribution()
returns table (linked int, trial_reserved int, trial_completed int, first_paid int)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_linked          int := 0;
    v_trial_reserved  int := 0;
    v_trial_completed int := 0;
    v_first_paid      int := 0;
begin
    -- profile 紐付け: profiles.email と attribution.email を citext で照合
    with up as (
        update public.marketing_attribution a
           set profile_id = p.id,
               profile_linked_at = coalesce(a.profile_linked_at, now())
          from public.profiles p
         where a.profile_id is null
           and lower(a.email::text) = lower(p.email::text)
        returning a.id
    )
    select count(*) into v_linked from up;

    -- 体験予約申込 (reservations.type='trial' の最初の作成日時)
    with up as (
        update public.marketing_attribution a
           set trial_reserved_at = sub.min_created
          from (
            select c.profile_id as profile_id, min(r.created_at) as min_created
              from public.reservations r
              join public.customers c on c.id = r.customer_id
             where r.type = 'trial'
             group by c.profile_id
          ) sub
         where a.profile_id = sub.profile_id
           and a.trial_reserved_at is null
        returning a.id
    )
    select count(*) into v_trial_reserved from up;

    -- 体験予約完了 (reservations.type='trial' && status='completed' の最初の更新日時)
    with up as (
        update public.marketing_attribution a
           set trial_completed_at = sub.min_completed
          from (
            select c.profile_id as profile_id, min(r.updated_at) as min_completed
              from public.reservations r
              join public.customers c on c.id = r.customer_id
             where r.type = 'trial' and r.status = 'completed'
             group by c.profile_id
          ) sub
         where a.profile_id = sub.profile_id
           and a.trial_completed_at is null
        returning a.id
    )
    select count(*) into v_trial_completed from up;

    -- 初回有料化 (payments.status='paid' の最初の updated_at + 同レコードの amount)
    with up as (
        update public.marketing_attribution a
           set first_paid_at = sub.min_paid_at,
               first_payment_jpy = sub.amount
          from (
            select c.profile_id as profile_id,
                   min(p.updated_at) as min_paid_at,
                   (array_agg(p.amount order by p.updated_at asc nulls last))[1] as amount
              from public.payments p
              join public.customers c on c.id = p.customer_id
             where p.status = 'paid'
             group by c.profile_id
          ) sub
         where a.profile_id = sub.profile_id
           and a.first_paid_at is null
        returning a.id
    )
    select count(*) into v_first_paid from up;

    return query select v_linked, v_trial_reserved, v_trial_completed, v_first_paid;
end;
$$;
revoke all on function public.fn_sync_marketing_attribution() from public;
grant execute on function public.fn_sync_marketing_attribution() to service_role;
