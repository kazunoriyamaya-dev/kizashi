-- =====================================================
-- ローカル開発用 seed データ
-- supabase db reset で自動適用される
--
-- 本番環境では適用しない。本番初期化は別途
-- supabase/seed/production.sql を用意して手動実行する。
-- =====================================================

-- =====================================================
-- system_settings (singleton)
-- Q022/Q023/Q005 などの初期値
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
    0,
    30,
    'require_review',
    true,
    72
)
on conflict do nothing;

-- =====================================================
-- cancel_policies 初期値
-- Q013: 1時間前まで無料キャンセル/変更
-- =====================================================
insert into public.cancel_policies (
    free_cancel_minutes_before_start,
    free_change_minutes_before_start,
    change_deadline_hours,
    cancel_deadline_hours,
    ticket_return_rule_in_deadline,
    ticket_return_rule_out_deadline,
    ticket_return_rule_company,
    ticket_return_rule_instructor
) values (
    60, 60,
    24, 24,
    'full_return',
    'no_return',
    'full_return',
    'full_return'
);

-- =====================================================
-- 開発用の管理者・講師・顧客プロフィール
-- 注意: 本番では Supabase Auth での実ユーザー作成 + auth トリガー経由で作成する
-- ここでは auth.users への INSERT も合わせてダミーで投入するが、
-- ローカル開発環境のみで使用する想定。
-- =====================================================

-- 管理者 (raw_user_meta_data.role で role を指定 → trigger fn_handle_new_user が profile を作成)
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at, aud, role, instance_id)
values (
    '00000000-0000-0000-0000-000000000001',
    'admin@kizashi.example.com',
    '{"role":"admin","name":"Kizashi 管理者"}'::jsonb,
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
)
on conflict (id) do nothing;

-- 講師サンプル（招待状態）
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at, aud, role, instance_id)
values (
    '00000000-0000-0000-0000-000000000002',
    'instructor.sample@kizashi.example.com',
    '{"role":"instructor","name":"講師サンプル"}'::jsonb,
    null,
    now(),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
)
on conflict (id) do nothing;

-- 講師は招待状態にしておく (trigger は active=default で作成するため上書き)
update public.profiles
   set status = 'invited'
 where id = '00000000-0000-0000-0000-000000000002';

-- 講師の住所
insert into public.addresses (id, owner_type, owner_id, postal_code, prefecture, city, address_line)
values (
    '11111111-0000-0000-0000-000000000001',
    'instructor',
    '00000000-0000-0000-0000-000000000099',
    '160-0023',
    '東京都',
    '新宿区',
    '西新宿1-1-1'
)
on conflict (id) do nothing;

-- 講師レコード
insert into public.instructors (
    id,
    profile_id,
    real_name,
    real_name_kana,
    nickname,
    public_bio,
    categories,
    genres,
    transportation_mode,
    base_address_id,
    rank,
    priority,
    status,
    contact_email
) values (
    '00000000-0000-0000-0000-000000000099',
    '00000000-0000-0000-0000-000000000002',
    'サンプル講師',
    'サンプルコウシ',
    'さくら先生',
    'サンプル講師のプロフィール本文',
    array['learning']::public.category[],
    array['国語', '算数']::text[],
    'train',
    '11111111-0000-0000-0000-000000000001',
    'silver',
    50,
    'invited',
    'instructor.sample@kizashi.example.com'
)
on conflict (id) do update set rank = excluded.rank;

-- 顧客サンプル（Google SSO 想定。trigger fn_handle_new_user が customers も自動作成）
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at, aud, role, instance_id)
values (
    '00000000-0000-0000-0000-000000000003',
    'customer.sample@kizashi.example.com',
    '{"role":"customer","name":"顧客サンプル太郎"}'::jsonb,
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
)
on conflict (id) do nothing;

-- 顧客のフリガナを補足
update public.customers
   set parent_kana = 'コキャクサンプルタロウ'
 where profile_id = '00000000-0000-0000-0000-000000000003';

-- 子供サンプル (trigger作成された customers の id を取得して紐付け)
insert into public.children (id, customer_id, name, kana, birth_date)
select
    '00000000-0000-0000-0000-000000000097'::uuid,
    c.id,
    '顧客花子',
    'コキャクハナコ',
    '2015-04-01'::date
  from public.customers c
 where c.profile_id = '00000000-0000-0000-0000-000000000003'
on conflict (id) do nothing;

-- =====================================================
-- チケット商品サンプル
-- =====================================================
insert into public.tickets (id, name, description, category, price, session_count, valid_days, duration_min, lesson_format, status, sort_order)
values
('00000000-0000-0000-0000-000000000201', '60分1回券', '60分の単発チケット', null, 4000, 1, 90, 60, 'solo', 'active', 10),
('00000000-0000-0000-0000-000000000202', '60分5回券', '60分のおまとめチケット', null, 18000, 5, 180, 60, 'solo', 'active', 20),
('00000000-0000-0000-0000-000000000203', '90分1回券', '90分の単発チケット', null, 6000, 1, 90, 90, 'solo', 'active', 30),
('00000000-0000-0000-0000-000000000204', '60分ペアレッスン1回券', 'ペアレッスン用チケット (Q001)', null, 6500, 1, 90, 60, 'pair', 'active', 40)
on conflict (id) do nothing;
