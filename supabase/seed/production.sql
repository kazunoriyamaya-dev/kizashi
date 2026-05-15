-- =====================================================
-- 本番初期化用 seed (一度だけ手動実行)
--
-- 用途:
--   1. system_settings の単一行を作成 (運用パラメータ初期値)
--   2. cancel_policies の単一行を作成 (キャンセル料規約)
--   3. tickets マスタの初期データ
--
-- 注意:
--   - 本番管理者は seed では作成しない。
--     Supabase Dashboard → Authentication → Users → "Invite user"
--     から admin@kizashi.example.com を招待し、auth.users の
--     raw_user_meta_data に {"role":"admin","name":"..."} を入れること。
--   - tickets の価格は要件に応じて UPDATE で調整する。
-- =====================================================

-- =====================================================
-- system_settings (singleton row)
-- 既存があれば何もしない
-- =====================================================
insert into public.system_settings (
    instructor_designation_fees,
    ticket_expiry_notify_days,
    reservation_window_days,
    reservation_open_hour,
    reservation_close_hour,
    onsite_buffer_minutes,
    online_buffer_minutes,
    car_fare_per_km,
    trial_duplicate_action,
    message_audit_disclosed,
    invite_token_ttl_hours
) values (
    '{"gold":1500,"silver":1000,"bronze":500,"regular":0}'::jsonb,
    '{30,14,7,1}',
    30,
    9,
    23,
    60,
    15,
    30,
    'admin_review',
    true,
    72
) on conflict do nothing;

-- =====================================================
-- cancel_policies (singleton row)
-- =====================================================
insert into public.cancel_policies (
    free_cancel_hours_before,
    customer_late_cancel_full_charge,
    instructor_cancel_full_refund,
    company_cancel_full_refund
) values (
    1, true, true, true
) on conflict do nothing;

-- =====================================================
-- tickets (商品マスタ)
-- 価格は本番要件に合わせて UPDATE で調整。
-- =====================================================
insert into public.tickets (
    name, category, lesson_format, duration_min, session_count, valid_days,
    price, status, sort_order
)
select * from (values
    ('体験レッスン (60分)',  'learning'::public.category, 'solo'::public.lesson_format, 60, 1, 30,  0,    'active'::public.ticket_status, 1),
    ('通常 10 回券 (60分)',  'learning'::public.category, 'solo'::public.lesson_format, 60, 10, 90, 33000,'active'::public.ticket_status, 10),
    ('通常 5 回券 (60分)',   'learning'::public.category, 'solo'::public.lesson_format, 60, 5, 60,  17500,'active'::public.ticket_status, 20),
    ('スポーツ 10 回券 (60分)','sports'::public.category, 'solo'::public.lesson_format, 60, 10, 90, 36000,'active'::public.ticket_status, 30),
    ('アート 10 回券 (60分)', 'art'::public.category,     'solo'::public.lesson_format, 60, 10, 90, 33000,'active'::public.ticket_status, 40)
) as t (name, category, lesson_format, duration_min, session_count, valid_days, price, status, sort_order)
where not exists (
    select 1 from public.tickets where public.tickets.name = t.name
);

-- =====================================================
-- マーケティング: ブログカテゴリ (Phase 15)
-- =====================================================
insert into public.marketing_blog_categories (slug, name, description)
values
    ('learning-tips', '学習法',     'お子様の学習効率を上げるコツや受験対策'),
    ('parent-voice',  '保護者の声', 'Kizashi をご利用中の保護者インタビュー'),
    ('news',          'お知らせ',   '新しい先生・キャンペーンなど')
on conflict (slug) do nothing;
