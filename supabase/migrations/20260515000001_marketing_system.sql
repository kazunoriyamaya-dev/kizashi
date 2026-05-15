-- =====================================================
-- マーケティング自動化システム
--
-- 対象範囲:
--  1. SNS 用アセット (画像 / バナー / 投稿 / 動画) 管理
--  2. 公式 LINE 運用 (セグメント / ブロードキャスト / 自動シナリオ)
--  3. ステップメール (シーケンス / ステップ / 配信ログ)
--  4. LP (ランディングページ) 作成・配信
--  5. ブログ CMS (記事・カテゴリ・タグ)
--  6. アフィリエイト (プログラム / リンク / クリック / コンバージョン)
--  7. 広告 (キャンペーン / 日次メトリクス) と分析イベント
--
-- 全テーブル RLS 有効化。基本ポリシー:
--  - admin: 全件可
--  - 公開対象 (lp/blog/affiliate links) は anon でも公開済みのみ select 可
--  - service role はバイパス (cron / webhook)
-- =====================================================

-- =====================================================
-- enum
-- =====================================================
create type public.marketing_asset_kind   as enum ('image', 'banner', 'video', 'document');
create type public.marketing_post_channel as enum ('twitter', 'instagram', 'facebook', 'tiktok', 'youtube', 'line');
create type public.marketing_post_status  as enum ('draft', 'scheduled', 'queued', 'published', 'failed', 'archived');
create type public.marketing_sequence_trigger as enum ('subscription', 'tag_added', 'event', 'manual');
create type public.marketing_email_status as enum ('pending', 'queued', 'sent', 'failed', 'unsubscribed');
create type public.marketing_subscriber_status as enum ('active', 'unsubscribed', 'bounced', 'complained');
create type public.marketing_lp_status    as enum ('draft', 'published', 'archived');
create type public.marketing_blog_status  as enum ('draft', 'scheduled', 'published', 'archived');
create type public.marketing_line_target as enum ('all', 'segment', 'tag');
create type public.marketing_ad_platform as enum ('meta', 'google', 'tiktok', 'yahoo', 'line_ads', 'other');
create type public.marketing_ad_status   as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.marketing_campaign_objective as enum ('awareness', 'traffic', 'lead', 'conversion', 'retention');

-- =====================================================
-- marketing_campaigns
--   各種マーケ施策をまとめる上位概念。SNS 投稿 / メールシーケンス / LP / 広告 etc を紐付ける。
-- =====================================================
create table public.marketing_campaigns (
    id              uuid                           primary key default gen_random_uuid(),
    name            text                           not null,
    slug            text                           not null unique,
    description     text,
    objective       public.marketing_campaign_objective not null default 'awareness',
    start_at        timestamptz,
    end_at          timestamptz,
    budget_jpy      integer                        not null default 0 check (budget_jpy >= 0),
    target_audience jsonb                          not null default '{}'::jsonb,
    is_active       boolean                        not null default true,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mkc_active_idx     on public.marketing_campaigns (is_active);
create index mkc_objective_idx  on public.marketing_campaigns (objective);
comment on table public.marketing_campaigns is 'マーケティングキャンペーン上位エンティティ';

-- =====================================================
-- marketing_assets
--   SNS / LP / ブログで使う画像・バナー・動画
-- =====================================================
create table public.marketing_assets (
    id              uuid                           primary key default gen_random_uuid(),
    campaign_id     uuid                           references public.marketing_campaigns(id) on delete set null,
    kind            public.marketing_asset_kind    not null,
    title           text                           not null,
    description     text,
    storage_path    text                           not null,
    public_url      text,
    mime_type       text,
    width_px        integer,
    height_px       integer,
    duration_sec    numeric(8, 2),
    file_size_bytes bigint,
    tags            text[]                         not null default '{}',
    ai_prompt       text,
    ai_provider     text,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mka_kind_idx      on public.marketing_assets (kind);
create index mka_campaign_idx  on public.marketing_assets (campaign_id);
create index mka_tags_gin      on public.marketing_assets using gin (tags);
comment on table public.marketing_assets is 'SNS / LP / ブログ用メディアアセットライブラリ';

-- =====================================================
-- marketing_sns_posts
--   SNS 用に予約投稿・公開する投稿エンティティ
-- =====================================================
create table public.marketing_sns_posts (
    id              uuid                           primary key default gen_random_uuid(),
    campaign_id     uuid                           references public.marketing_campaigns(id) on delete set null,
    channel         public.marketing_post_channel  not null,
    body            text                           not null,
    asset_ids       uuid[]                         not null default '{}',
    hashtags        text[]                         not null default '{}',
    scheduled_at    timestamptz,
    published_at    timestamptz,
    status          public.marketing_post_status   not null default 'draft',
    external_post_id text,
    error_message   text,
    metrics         jsonb                          not null default '{}'::jsonb,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mksp_status_idx     on public.marketing_sns_posts (status);
create index mksp_channel_idx    on public.marketing_sns_posts (channel);
create index mksp_scheduled_idx  on public.marketing_sns_posts (scheduled_at) where status in ('scheduled', 'queued');
create index mksp_campaign_idx   on public.marketing_sns_posts (campaign_id);
comment on table public.marketing_sns_posts is 'SNS 投稿 (各チャネル横断)';

-- =====================================================
-- marketing_line_segments
--   公式 LINE ブロードキャストのターゲットセグメント定義
-- =====================================================
create table public.marketing_line_segments (
    id              uuid                           primary key default gen_random_uuid(),
    name            text                           not null,
    description     text,
    filter          jsonb                          not null default '{}'::jsonb,
    estimated_size  integer                        not null default 0 check (estimated_size >= 0),
    is_active       boolean                        not null default true,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mkls_active_idx on public.marketing_line_segments (is_active);
comment on table public.marketing_line_segments is 'LINE ブロードキャストのセグメント定義';

-- =====================================================
-- marketing_line_broadcasts
--   LINE ブロードキャスト本体 (予約配信対応)
-- =====================================================
create table public.marketing_line_broadcasts (
    id              uuid                           primary key default gen_random_uuid(),
    campaign_id     uuid                           references public.marketing_campaigns(id) on delete set null,
    segment_id      uuid                           references public.marketing_line_segments(id) on delete set null,
    title           text                           not null,
    target_type     public.marketing_line_target   not null default 'all',
    target_tag      text,
    messages        jsonb                          not null default '[]'::jsonb,
    scheduled_at    timestamptz,
    sent_at         timestamptz,
    status          public.marketing_post_status   not null default 'draft',
    sent_count      integer                        not null default 0 check (sent_count >= 0),
    delivered_count integer                        not null default 0 check (delivered_count >= 0),
    failed_count    integer                        not null default 0 check (failed_count >= 0),
    error_message   text,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mklb_status_idx    on public.marketing_line_broadcasts (status);
create index mklb_scheduled_idx on public.marketing_line_broadcasts (scheduled_at) where status in ('scheduled', 'queued');
comment on table public.marketing_line_broadcasts is 'LINE 公式アカウント ブロードキャスト';

-- =====================================================
-- marketing_line_scenarios
--   LINE 自動応答 / ステップシナリオ定義
-- =====================================================
create table public.marketing_line_scenarios (
    id              uuid                           primary key default gen_random_uuid(),
    name            text                           not null,
    trigger_keyword text,                          -- このキーワードを受信したら起動
    trigger_event   text,                          -- friend_added / postback / etc
    steps           jsonb                          not null default '[]'::jsonb,
    is_active       boolean                        not null default true,
    created_by      uuid                           references public.profiles(id) on delete set null,
    created_at      timestamptz                    not null default now(),
    updated_at      timestamptz                    not null default now()
);
create index mklsc_active_idx on public.marketing_line_scenarios (is_active);
comment on table public.marketing_line_scenarios is 'LINE 自動応答 / ステップシナリオ';

-- =====================================================
-- marketing_email_sequences
--   ステップメールのシナリオ親
-- =====================================================
create table public.marketing_email_sequences (
    id              uuid                            primary key default gen_random_uuid(),
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    name            text                            not null,
    description     text,
    trigger         public.marketing_sequence_trigger not null default 'subscription',
    trigger_tag     text,
    from_name       text                            not null default 'Kizashi',
    from_email      text                            not null,
    reply_to        text,
    is_active       boolean                         not null default true,
    created_by      uuid                            references public.profiles(id) on delete set null,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
create index mkes_active_idx on public.marketing_email_sequences (is_active);
comment on table public.marketing_email_sequences is 'ステップメールのシナリオ';

-- =====================================================
-- marketing_email_sequence_steps
--   シーケンス内のステップ (順序 / 遅延 / 件名 / 本文)
-- =====================================================
create table public.marketing_email_sequence_steps (
    id              uuid                            primary key default gen_random_uuid(),
    sequence_id     uuid                            not null references public.marketing_email_sequences(id) on delete cascade,
    step_order      integer                         not null check (step_order >= 0),
    delay_minutes   integer                         not null default 0 check (delay_minutes >= 0),
    subject         text                            not null,
    body_text       text                            not null,
    body_html       text,
    cta_url         text,
    is_active       boolean                         not null default true,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now(),
    unique (sequence_id, step_order)
);
create index mkess_sequence_idx on public.marketing_email_sequence_steps (sequence_id, step_order);
comment on table public.marketing_email_sequence_steps is 'ステップメール 各ステップ';

-- =====================================================
-- marketing_email_subscribers
--   ステップメール購読者
-- =====================================================
create table public.marketing_email_subscribers (
    id              uuid                            primary key default gen_random_uuid(),
    email           extensions.citext               not null,
    name            text,
    profile_id      uuid                            references public.profiles(id) on delete set null,
    source          text                            not null default 'lp',
    landing_page_id uuid,                           -- 後から FK 付け
    tags            text[]                          not null default '{}',
    status          public.marketing_subscriber_status not null default 'active',
    consent_at      timestamptz                     not null default now(),
    unsubscribed_at timestamptz,
    metadata        jsonb                           not null default '{}'::jsonb,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now(),
    unique (email)
);
create index mksub_status_idx  on public.marketing_email_subscribers (status);
create index mksub_tags_gin    on public.marketing_email_subscribers using gin (tags);
create index mksub_lp_idx      on public.marketing_email_subscribers (landing_page_id);
comment on table public.marketing_email_subscribers is 'ステップメール購読者';

-- =====================================================
-- marketing_email_enrollments
--   購読者 x シーケンスの登録 (進捗管理)
-- =====================================================
create table public.marketing_email_enrollments (
    id              uuid                            primary key default gen_random_uuid(),
    subscriber_id   uuid                            not null references public.marketing_email_subscribers(id) on delete cascade,
    sequence_id     uuid                            not null references public.marketing_email_sequences(id) on delete cascade,
    next_step_order integer                         not null default 0,
    next_send_at    timestamptz                     not null default now(),
    completed_at    timestamptz,
    cancelled_at    timestamptz,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now(),
    unique (subscriber_id, sequence_id)
);
create index mken_next_send_idx on public.marketing_email_enrollments (next_send_at) where completed_at is null and cancelled_at is null;
create index mken_sequence_idx  on public.marketing_email_enrollments (sequence_id);
comment on table public.marketing_email_enrollments is '購読者 × シーケンス エンロールメント (進捗)';

-- =====================================================
-- marketing_email_sends
--   個別配信ログ (どの subscriber, どのシーケンス, どのステップが送信されたか)
-- =====================================================
create table public.marketing_email_sends (
    id              uuid                            primary key default gen_random_uuid(),
    subscriber_id   uuid                            not null references public.marketing_email_subscribers(id) on delete cascade,
    sequence_id     uuid                            references public.marketing_email_sequences(id) on delete set null,
    step_id         uuid                            references public.marketing_email_sequence_steps(id) on delete set null,
    to_email        extensions.citext               not null,
    subject         text                            not null,
    body_text       text                            not null,
    body_html       text,
    status          public.marketing_email_status   not null default 'pending',
    provider_id     text,
    error_message   text,
    opened_at       timestamptz,
    clicked_at      timestamptz,
    sent_at         timestamptz,
    created_at      timestamptz                     not null default now()
);
create index mksnd_status_idx     on public.marketing_email_sends (status);
create index mksnd_subscriber_idx on public.marketing_email_sends (subscriber_id);
create index mksnd_sequence_idx   on public.marketing_email_sends (sequence_id);
comment on table public.marketing_email_sends is 'ステップメール 個別配信ログ';

-- =====================================================
-- marketing_landing_pages
--   LP (ランディングページ)。blocks (jsonb) で構造化保存
-- =====================================================
create table public.marketing_landing_pages (
    id              uuid                            primary key default gen_random_uuid(),
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    sequence_id     uuid                            references public.marketing_email_sequences(id) on delete set null,
    slug            text                            not null unique,
    title           text                            not null,
    headline        text                            not null,
    subheadline     text,
    hero_asset_id   uuid                            references public.marketing_assets(id) on delete set null,
    blocks          jsonb                           not null default '[]'::jsonb,
    meta_title      text,
    meta_description text,
    og_image_url    text,
    status          public.marketing_lp_status      not null default 'draft',
    publish_at      timestamptz,
    unpublish_at    timestamptz,
    view_count      integer                         not null default 0 check (view_count >= 0),
    conversion_count integer                        not null default 0 check (conversion_count >= 0),
    template_key    text,
    ai_prompt       text,
    created_by      uuid                            references public.profiles(id) on delete set null,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
create index mklp_status_idx   on public.marketing_landing_pages (status);
create index mklp_publish_idx  on public.marketing_landing_pages (publish_at) where status = 'scheduled';
create index mklp_campaign_idx on public.marketing_landing_pages (campaign_id);
comment on table public.marketing_landing_pages is 'LP 本体 (blocks で構造化)';

-- subscribers の landing_page_id に FK を後付け
alter table public.marketing_email_subscribers
    add constraint marketing_email_subscribers_landing_page_fk
    foreign key (landing_page_id) references public.marketing_landing_pages(id) on delete set null;

-- =====================================================
-- marketing_blog_categories
-- =====================================================
create table public.marketing_blog_categories (
    id              uuid                            primary key default gen_random_uuid(),
    slug            text                            not null unique,
    name            text                            not null,
    description     text,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
comment on table public.marketing_blog_categories is 'ブログ カテゴリ';

-- =====================================================
-- marketing_blog_posts
--   HP 内 CMS ブログ
-- =====================================================
create table public.marketing_blog_posts (
    id              uuid                            primary key default gen_random_uuid(),
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    category_id     uuid                            references public.marketing_blog_categories(id) on delete set null,
    slug            text                            not null unique,
    title           text                            not null,
    excerpt         text,
    body_markdown   text                            not null,
    body_html       text,
    hero_asset_id   uuid                            references public.marketing_assets(id) on delete set null,
    tags            text[]                          not null default '{}',
    meta_title      text,
    meta_description text,
    og_image_url    text,
    status          public.marketing_blog_status    not null default 'draft',
    publish_at      timestamptz,
    published_at    timestamptz,
    view_count      integer                         not null default 0 check (view_count >= 0),
    reading_minutes integer,
    author_profile_id uuid                          references public.profiles(id) on delete set null,
    author_display_name text,
    ai_prompt       text,
    ai_model        text,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
create index mkblog_status_idx     on public.marketing_blog_posts (status);
create index mkblog_publish_idx    on public.marketing_blog_posts (publish_at) where status = 'scheduled';
create index mkblog_category_idx   on public.marketing_blog_posts (category_id);
create index mkblog_tags_gin       on public.marketing_blog_posts using gin (tags);
create index mkblog_published_at_idx on public.marketing_blog_posts (published_at desc) where status = 'published';
comment on table public.marketing_blog_posts is 'ブログ記事 (Markdown 本体 + HTML キャッシュ)';

-- =====================================================
-- marketing_affiliate_programs
--   外部 ASP プログラムの登録
-- =====================================================
create table public.marketing_affiliate_programs (
    id              uuid                            primary key default gen_random_uuid(),
    name            text                            not null,
    network         text                            not null,           -- a8 / valuecommerce / amazon / rakuten / 自社 etc
    program_id      text,                           -- ASP 側 ID
    base_url        text                            not null,           -- 元 URL
    default_commission_jpy integer,
    default_commission_rate numeric(5, 2),
    notes           text,
    is_active       boolean                         not null default true,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
create index mkap_active_idx on public.marketing_affiliate_programs (is_active);
comment on table public.marketing_affiliate_programs is 'アフィリエイト プログラム マスタ';

-- =====================================================
-- marketing_affiliate_links
--   短縮リダイレクト用リンク。/r/[code] で 302
-- =====================================================
create table public.marketing_affiliate_links (
    id              uuid                            primary key default gen_random_uuid(),
    program_id      uuid                            references public.marketing_affiliate_programs(id) on delete set null,
    blog_post_id    uuid                            references public.marketing_blog_posts(id) on delete set null,
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    code            text                            not null unique,    -- /r/{code}
    target_url      text                            not null,
    label           text,
    utm_source      text,
    utm_medium      text,
    utm_campaign    text,
    utm_content     text,
    is_active       boolean                         not null default true,
    click_count     integer                         not null default 0 check (click_count >= 0),
    conversion_count integer                        not null default 0 check (conversion_count >= 0),
    created_by      uuid                            references public.profiles(id) on delete set null,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now()
);
create index mkal_code_idx       on public.marketing_affiliate_links (code);
create index mkal_program_idx    on public.marketing_affiliate_links (program_id);
create index mkal_blog_post_idx  on public.marketing_affiliate_links (blog_post_id);
create index mkal_campaign_idx   on public.marketing_affiliate_links (campaign_id);
comment on table public.marketing_affiliate_links is 'アフィリエイト 短縮リダイレクトリンク';

-- =====================================================
-- marketing_affiliate_clicks
--   クリック追跡 (簡易: IP ハッシュ・User-Agent・referrer)
-- =====================================================
create table public.marketing_affiliate_clicks (
    id              uuid                            primary key default gen_random_uuid(),
    link_id         uuid                            not null references public.marketing_affiliate_links(id) on delete cascade,
    ip_hash         text,
    user_agent      text,
    referrer        text,
    country         text,
    device          text,
    clicked_at      timestamptz                     not null default now()
);
create index mkacl_link_idx on public.marketing_affiliate_clicks (link_id);
create index mkacl_time_idx on public.marketing_affiliate_clicks (clicked_at desc);
comment on table public.marketing_affiliate_clicks is 'アフィリエイト クリックログ';

-- =====================================================
-- marketing_affiliate_conversions
--   ASP の postback webhook を受けて登録
-- =====================================================
create table public.marketing_affiliate_conversions (
    id              uuid                            primary key default gen_random_uuid(),
    link_id         uuid                            references public.marketing_affiliate_links(id) on delete set null,
    program_id      uuid                            references public.marketing_affiliate_programs(id) on delete set null,
    external_order_id text,
    commission_jpy  integer                         not null default 0,
    status          text                            not null default 'pending',  -- pending / confirmed / rejected
    raw_payload     jsonb                           not null default '{}'::jsonb,
    converted_at    timestamptz                     not null default now(),
    confirmed_at    timestamptz
);
create index mkacv_link_idx    on public.marketing_affiliate_conversions (link_id);
create index mkacv_status_idx  on public.marketing_affiliate_conversions (status);
comment on table public.marketing_affiliate_conversions is 'アフィリエイト コンバージョン (ASP postback)';

-- =====================================================
-- marketing_ad_campaigns
--   広告キャンペーン (外部 ad platform と紐付け)
-- =====================================================
create table public.marketing_ad_campaigns (
    id              uuid                            primary key default gen_random_uuid(),
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    landing_page_id uuid                            references public.marketing_landing_pages(id) on delete set null,
    platform        public.marketing_ad_platform    not null,
    external_id     text,                           -- ad platform 側 campaign id
    name            text                            not null,
    objective       text,
    daily_budget_jpy integer                        not null default 0 check (daily_budget_jpy >= 0),
    total_budget_jpy integer                        not null default 0 check (total_budget_jpy >= 0),
    status          public.marketing_ad_status      not null default 'draft',
    start_at        timestamptz,
    end_at          timestamptz,
    target_audience jsonb                           not null default '{}'::jsonb,
    creative_asset_ids uuid[]                       not null default '{}',
    notes           text,
    created_by      uuid                            references public.profiles(id) on delete set null,
    created_at      timestamptz                     not null default now(),
    updated_at      timestamptz                     not null default now(),
    unique (platform, external_id)
);
create index mkadc_status_idx   on public.marketing_ad_campaigns (status);
create index mkadc_platform_idx on public.marketing_ad_campaigns (platform);
comment on table public.marketing_ad_campaigns is '広告キャンペーン (外部 ad platform 連携)';

-- =====================================================
-- marketing_ad_metrics_daily
--   日次広告メトリクス (impressions / clicks / conversions / spend)
-- =====================================================
create table public.marketing_ad_metrics_daily (
    id              uuid                            primary key default gen_random_uuid(),
    ad_campaign_id  uuid                            not null references public.marketing_ad_campaigns(id) on delete cascade,
    date            date                            not null,
    impressions     integer                         not null default 0 check (impressions >= 0),
    clicks          integer                         not null default 0 check (clicks >= 0),
    conversions     integer                         not null default 0 check (conversions >= 0),
    spend_jpy       integer                         not null default 0 check (spend_jpy >= 0),
    revenue_jpy     integer                         not null default 0 check (revenue_jpy >= 0),
    raw_payload     jsonb                           not null default '{}'::jsonb,
    fetched_at      timestamptz                     not null default now(),
    unique (ad_campaign_id, date)
);
create index mkadm_date_idx     on public.marketing_ad_metrics_daily (date desc);
create index mkadm_campaign_idx on public.marketing_ad_metrics_daily (ad_campaign_id);
comment on table public.marketing_ad_metrics_daily is '広告 日次メトリクス';

-- =====================================================
-- marketing_analytics_events
--   汎用イベント受信 (LP / ブログ / 広告クリック / 購読など)
-- =====================================================
create table public.marketing_analytics_events (
    id              uuid                            primary key default gen_random_uuid(),
    event_name      text                            not null,
    campaign_id     uuid                            references public.marketing_campaigns(id) on delete set null,
    landing_page_id uuid                            references public.marketing_landing_pages(id) on delete set null,
    blog_post_id    uuid                            references public.marketing_blog_posts(id) on delete set null,
    sns_post_id     uuid                            references public.marketing_sns_posts(id) on delete set null,
    affiliate_link_id uuid                          references public.marketing_affiliate_links(id) on delete set null,
    subscriber_id   uuid                            references public.marketing_email_subscribers(id) on delete set null,
    profile_id      uuid                            references public.profiles(id) on delete set null,
    session_id      text,
    ip_hash         text,
    user_agent      text,
    referrer        text,
    utm_source      text,
    utm_medium      text,
    utm_campaign    text,
    utm_content     text,
    properties      jsonb                           not null default '{}'::jsonb,
    created_at      timestamptz                     not null default now()
);
create index mkae_event_idx     on public.marketing_analytics_events (event_name);
create index mkae_campaign_idx  on public.marketing_analytics_events (campaign_id);
create index mkae_time_idx      on public.marketing_analytics_events (created_at desc);
create index mkae_lp_idx        on public.marketing_analytics_events (landing_page_id);
create index mkae_blog_idx      on public.marketing_analytics_events (blog_post_id);
comment on table public.marketing_analytics_events is 'マーケ汎用イベントログ';

-- =====================================================
-- RLS
-- 共通: admin は全件可。anon は公開対象テーブルのみ select 可。
-- =====================================================
alter table public.marketing_campaigns               enable row level security;
alter table public.marketing_assets                  enable row level security;
alter table public.marketing_sns_posts               enable row level security;
alter table public.marketing_line_segments           enable row level security;
alter table public.marketing_line_broadcasts         enable row level security;
alter table public.marketing_line_scenarios          enable row level security;
alter table public.marketing_email_sequences         enable row level security;
alter table public.marketing_email_sequence_steps    enable row level security;
alter table public.marketing_email_subscribers       enable row level security;
alter table public.marketing_email_enrollments       enable row level security;
alter table public.marketing_email_sends             enable row level security;
alter table public.marketing_landing_pages           enable row level security;
alter table public.marketing_blog_categories         enable row level security;
alter table public.marketing_blog_posts              enable row level security;
alter table public.marketing_affiliate_programs      enable row level security;
alter table public.marketing_affiliate_links         enable row level security;
alter table public.marketing_affiliate_clicks        enable row level security;
alter table public.marketing_affiliate_conversions   enable row level security;
alter table public.marketing_ad_campaigns            enable row level security;
alter table public.marketing_ad_metrics_daily        enable row level security;
alter table public.marketing_analytics_events        enable row level security;

-- ===== admin all-access ポリシー (共通) =====
do $$
declare
    t text;
    tables text[] := array[
        'marketing_campaigns',
        'marketing_assets',
        'marketing_sns_posts',
        'marketing_line_segments',
        'marketing_line_broadcasts',
        'marketing_line_scenarios',
        'marketing_email_sequences',
        'marketing_email_sequence_steps',
        'marketing_email_subscribers',
        'marketing_email_enrollments',
        'marketing_email_sends',
        'marketing_landing_pages',
        'marketing_blog_categories',
        'marketing_blog_posts',
        'marketing_affiliate_programs',
        'marketing_affiliate_links',
        'marketing_affiliate_clicks',
        'marketing_affiliate_conversions',
        'marketing_ad_campaigns',
        'marketing_ad_metrics_daily',
        'marketing_analytics_events'
    ];
begin
    foreach t in array tables loop
        execute format(
            'create policy %1$s_admin_all on public.%1$I for all using (public.fn_is_admin()) with check (public.fn_is_admin())',
            t
        );
    end loop;
end$$;

-- ===== 公開エンドポイント anon ポリシー =====

-- LP: published のみ anon select 可
create policy marketing_landing_pages_anon_select
    on public.marketing_landing_pages for select
    to anon, authenticated
    using (
        public.fn_is_admin()
        or (status = 'published'
            and (publish_at is null or publish_at <= now())
            and (unpublish_at is null or unpublish_at > now())
        )
    );

-- ブログ: published のみ anon select 可
create policy marketing_blog_posts_anon_select
    on public.marketing_blog_posts for select
    to anon, authenticated
    using (
        public.fn_is_admin()
        or (status = 'published'
            and (publish_at is null or publish_at <= now())
        )
    );

-- ブログカテゴリ: 誰でも select 可
create policy marketing_blog_categories_anon_select
    on public.marketing_blog_categories for select
    to anon, authenticated
    using (true);

-- アフィリエイトリンク: 誰でも select 可 (リダイレクト用)
create policy marketing_affiliate_links_anon_select
    on public.marketing_affiliate_links for select
    to anon, authenticated
    using (is_active);

-- =====================================================
-- updated_at トリガーは fn_set_updated_at の一括登録 do ブロックで
-- 既に貼られているので、新規テーブルでも自動付与される (既存 migration 12)
-- が、12 のブロックは既に実行済み。改めてここで対象テーブルにループ登録する。
-- =====================================================
do $$
declare
    rec record;
begin
    for rec in
        select table_name
        from information_schema.columns
        where table_schema = 'public'
          and column_name = 'updated_at'
          and table_name like 'marketing_%'
    loop
        execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', rec.table_name);
        execute format(
            'create trigger trg_%1$s_updated_at before update on public.%1$I for each row execute function public.fn_set_updated_at()',
            rec.table_name
        );
    end loop;
end$$;

-- =====================================================
-- helper RPC: アフィリエイトクリックを記録しつつカウンタをインクリメント
-- =====================================================
create or replace function public.fn_record_affiliate_click(
    p_link_id   uuid,
    p_ip_hash   text,
    p_user_agent text,
    p_referrer  text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.marketing_affiliate_clicks (link_id, ip_hash, user_agent, referrer)
    values (p_link_id, p_ip_hash, p_user_agent, p_referrer);

    update public.marketing_affiliate_links
       set click_count = click_count + 1,
           updated_at  = now()
     where id = p_link_id;
end;
$$;
revoke all on function public.fn_record_affiliate_click(uuid, text, text, text) from public;
grant execute on function public.fn_record_affiliate_click(uuid, text, text, text) to anon, authenticated, service_role;

-- =====================================================
-- helper RPC: LP / blog view count をインクリメント (atomic)
-- =====================================================
create or replace function public.fn_increment_landing_page_view(p_lp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.marketing_landing_pages
       set view_count = view_count + 1,
           updated_at = now()
     where id = p_lp_id;
end;
$$;
revoke all on function public.fn_increment_landing_page_view(uuid) from public;
grant execute on function public.fn_increment_landing_page_view(uuid) to anon, authenticated, service_role;

create or replace function public.fn_increment_blog_view(p_blog_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.marketing_blog_posts
       set view_count = view_count + 1,
           updated_at = now()
     where id = p_blog_id;
end;
$$;
revoke all on function public.fn_increment_blog_view(uuid) from public;
grant execute on function public.fn_increment_blog_view(uuid) to anon, authenticated, service_role;
