-- =====================================================
-- 体験予約 RPC
--
-- 設計書 F030 / Q002 / Q003 / Q004:
--  - チケット消化なし（無料）
--  - 子供 1 人につき 1 回のみ (children.trial_used で制御)
--  - Q003: 子供の氏名+カナ+生年月日完全一致時は trial_pending_reviews に登録
--  - 自動割当は呼び出し側 (lib/reservations/auto-assign.ts) で実施
--
-- 2 つの RPC を提供:
--  1. fn_create_trial_reservation: 自動割当済みの instructor_id を受け取り予約を作成
--  2. fn_register_trial_pending: 重複検知時、管理者承認待ちに登録
-- =====================================================

-- =====================================================
-- 1. fn_create_trial_reservation
--    重複なし or 管理者承認後 に呼ぶ
-- =====================================================
create or replace function public.fn_create_trial_reservation(
    p_customer_id         uuid,
    p_child_id            uuid,
    p_instructor_id       uuid,
    p_category            public.category,
    p_start_at            timestamptz,
    p_end_at              timestamptz,
    p_duration_min        integer,
    p_delivery_type       public.delivery_type
)
returns table (
    reservation_id   uuid,
    designation_fee  integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_child           public.children;
    v_instructor      public.instructors;
    v_reservation_id  uuid;
    v_designation_fee integer := 0;
    v_settings        public.system_settings;
    v_fees            jsonb;
begin
    -- 子供取得 + 行ロック
    select * into v_child
      from public.children
     where id = p_child_id
       and customer_id = p_customer_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'child_not_found';
    end if;
    if v_child.trial_used then
        raise exception using errcode = 'P0001', message = 'trial_already_used';
    end if;

    -- 講師取得
    select * into v_instructor
      from public.instructors
     where id = p_instructor_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'instructor_not_found';
    end if;
    if v_instructor.status <> 'active' then
        raise exception using errcode = 'P0001', message = 'instructor_inactive';
    end if;

    -- 指名料は体験予約でも適用 (Q023)
    select * into v_settings from public.system_settings limit 1;
    v_fees := coalesce(
        v_settings.instructor_designation_fees,
        '{"gold":1500,"silver":1000,"bronze":500,"regular":0}'::jsonb
    );
    v_designation_fee := coalesce((v_fees ->> v_instructor.rank::text)::integer, 0);

    -- reservations INSERT (体験予約はチケット消化なし、customer_ticket_id=NULL)
    insert into public.reservations (
        customer_id, child_id, instructor_id,
        category, reservation_type,
        start_at, end_at, duration_min,
        delivery_type,
        designation_fee, status, confirmed_at
    ) values (
        p_customer_id, p_child_id, p_instructor_id,
        p_category, 'trial',
        p_start_at, p_end_at, p_duration_min,
        p_delivery_type,
        v_designation_fee, 'confirmed', now()
    ) returning id into v_reservation_id;

    -- children.trial_used = true
    update public.children
       set trial_used = true,
           updated_at = now()
     where id = p_child_id;

    -- audit_logs
    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        (select profile_id from public.customers where id = p_customer_id),
        'customer',
        'reservation.trial_created',
        'reservations',
        v_reservation_id,
        jsonb_build_object(
            'instructor_id',  p_instructor_id,
            'child_id',       p_child_id,
            'designation_fee', v_designation_fee
        )
    );

    return query select v_reservation_id, v_designation_fee;
end;
$$;

revoke execute on function public.fn_create_trial_reservation(
    uuid, uuid, uuid, public.category, timestamptz, timestamptz, integer, public.delivery_type
) from public;
grant execute on function public.fn_create_trial_reservation(
    uuid, uuid, uuid, public.category, timestamptz, timestamptz, integer, public.delivery_type
) to service_role;

comment on function public.fn_create_trial_reservation is
    'C008/API017 体験予約作成 RPC。チケット消化なし、children.trial_used=true (Q002/Q003)';

-- =====================================================
-- 2. fn_register_trial_pending
--    Q003 完全一致検出時に管理者承認待ちで登録
-- =====================================================
create or replace function public.fn_register_trial_pending(
    p_customer_id        uuid,
    p_child_id           uuid,
    p_matched_child_id   uuid,
    p_requested_payload  jsonb
)
returns table (
    review_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_review_id uuid;
begin
    insert into public.trial_pending_reviews (
        customer_id, child_id, matched_child_id,
        requested_payload, status
    ) values (
        p_customer_id, p_child_id, p_matched_child_id,
        p_requested_payload, 'pending'
    ) returning id into v_review_id;

    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        (select profile_id from public.customers where id = p_customer_id),
        'customer',
        'trial_pending.registered',
        'trial_pending_reviews',
        v_review_id,
        p_requested_payload
    );

    return query select v_review_id;
end;
$$;

revoke execute on function public.fn_register_trial_pending(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.fn_register_trial_pending(uuid, uuid, uuid, jsonb) to service_role;

comment on function public.fn_register_trial_pending is
    'Q003 完全一致重複検出時の管理者承認待ち登録';
