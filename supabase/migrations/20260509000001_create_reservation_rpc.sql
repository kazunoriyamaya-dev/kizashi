-- =====================================================
-- 通常予約作成 RPC
--
-- フロー (1 トランザクション):
--  1. customer_tickets の所有者・残数・有効期限を SELECT FOR UPDATE で取得（行ロック）
--  2. 残数が 0 / 期限切れ / 違う customer なら ERROR
--  3. 講師の rank に応じて designation_fee を計算（system_settings から取得）
--  4. reservations INSERT (status='confirmed')
--     ↳ EXCLUDE 制約により同一講師時間帯の重複は自動で例外発生
--  5. customer_tickets.remaining_count -= 1
--  6. 残数 0 になったら status='used' に状態遷移
--  7. 予約ID を返す
--
-- 呼び出し側 (Server Action):
--  - 成功時: Google Calendar event 作成 → reservations.google_event_id/google_meet_url 反映
--  - 失敗時: SQLSTATE で分岐
--    - 23P01 EXCLUDE 制約違反 → 「他の方が同じ時間帯に予約済み」
--    - P0001 raise exception → 業務エラー (チケット残数不足等)
-- =====================================================

create or replace function public.fn_create_normal_reservation(
    p_customer_id         uuid,
    p_child_id            uuid,
    p_instructor_id       uuid,
    p_category            public.category,
    p_start_at            timestamptz,
    p_end_at              timestamptz,
    p_duration_min        integer,
    p_delivery_type       public.delivery_type,
    p_location_address_id uuid,
    p_customer_ticket_id  uuid,
    p_pair_participants   jsonb default '[]'::jsonb
)
returns table (
    reservation_id  uuid,
    designation_fee integer,
    ticket_status   public.customer_ticket_status,
    remaining_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ticket          public.customer_tickets;
    v_instructor      public.instructors;
    v_designation_fee integer := 0;
    v_settings        public.system_settings;
    v_fees            jsonb;
    v_reservation_id  uuid;
    v_new_remaining   integer;
    v_new_status      public.customer_ticket_status;
begin
    -- 1. チケットを行ロック付きで取得
    select * into v_ticket
      from public.customer_tickets
     where id = p_customer_ticket_id
     for update;

    if not found then
        raise exception using errcode = 'P0001',
            message = 'ticket_not_found';
    end if;

    if v_ticket.customer_id <> p_customer_id then
        raise exception using errcode = 'P0001',
            message = 'ticket_owner_mismatch';
    end if;

    if v_ticket.status <> 'active' then
        raise exception using errcode = 'P0001',
            message = 'ticket_inactive';
    end if;

    if v_ticket.remaining_count <= 0 then
        raise exception using errcode = 'P0001',
            message = 'ticket_remaining_zero';
    end if;

    if v_ticket.expires_at < now() then
        raise exception using errcode = 'P0001',
            message = 'ticket_expired';
    end if;

    -- 2. 講師取得 (rank を見るため)
    select * into v_instructor
      from public.instructors
     where id = p_instructor_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'instructor_not_found';
    end if;
    if v_instructor.status <> 'active' then
        raise exception using errcode = 'P0001', message = 'instructor_inactive';
    end if;

    -- 3. 指名料計算 (Q023)
    select * into v_settings from public.system_settings limit 1;
    v_fees := coalesce(
        v_settings.instructor_designation_fees,
        '{"gold":1500,"silver":1000,"bronze":500,"regular":0}'::jsonb
    );
    v_designation_fee := coalesce((v_fees ->> v_instructor.rank::text)::integer, 0);

    -- 4. reservations INSERT
    --    EXCLUDE 制約により講師の時間重複は 23P01 で失敗する
    insert into public.reservations (
        customer_id, child_id, instructor_id,
        category, reservation_type,
        start_at, end_at, duration_min,
        delivery_type, location_address_id,
        customer_ticket_id, designation_fee,
        pair_participants, status, confirmed_at
    ) values (
        p_customer_id, p_child_id, p_instructor_id,
        p_category, 'normal',
        p_start_at, p_end_at, p_duration_min,
        p_delivery_type, p_location_address_id,
        p_customer_ticket_id, v_designation_fee,
        p_pair_participants, 'confirmed', now()
    )
    returning id into v_reservation_id;

    -- 5. チケット消化
    v_new_remaining := v_ticket.remaining_count - 1;
    v_new_status := case when v_new_remaining = 0 then 'used'::public.customer_ticket_status else v_ticket.status end;

    update public.customer_tickets
       set remaining_count = v_new_remaining,
           status          = v_new_status,
           updated_at      = now()
     where id = p_customer_ticket_id;

    -- 6. 監査ログ
    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        (select profile_id from public.customers where id = p_customer_id),
        'customer',
        'reservation.created',
        'reservations',
        v_reservation_id,
        jsonb_build_object(
            'instructor_id',  p_instructor_id,
            'designation_fee', v_designation_fee,
            'ticket_used',     true
        )
    );

    -- 7. 戻り値
    return query select v_reservation_id, v_designation_fee, v_new_status, v_new_remaining;
end;
$$;

-- 権限
revoke execute on function public.fn_create_normal_reservation(
    uuid, uuid, uuid, public.category, timestamptz, timestamptz, integer,
    public.delivery_type, uuid, uuid, jsonb
) from public;

grant execute on function public.fn_create_normal_reservation(
    uuid, uuid, uuid, public.category, timestamptz, timestamptz, integer,
    public.delivery_type, uuid, uuid, jsonb
) to authenticated, service_role;

comment on function public.fn_create_normal_reservation is
    'C005/API016 通常予約作成 RPC。チケット行ロック + 消化 + INSERT を 1 transaction で実行。23P01 で時間重複検出。';

-- =====================================================
-- 予約の Calendar event 情報を保存する補助 RPC
--  - Calendar API 呼び出し成功後に Server 側から呼ぶ
--  - reservations.google_event_id / google_meet_url を更新
--  - google_meet_links に履歴記録
-- =====================================================
create or replace function public.fn_attach_calendar_event(
    p_reservation_id uuid,
    p_event_id       text,
    p_meet_url       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.reservations
       set google_event_id = p_event_id,
           google_meet_url = coalesce(p_meet_url, google_meet_url),
           updated_at      = now()
     where id = p_reservation_id;

    if p_meet_url is not null then
        insert into public.google_meet_links (reservation_id, meet_url, google_event_id)
        values (p_reservation_id, p_meet_url, p_event_id)
        on conflict (reservation_id) do update
           set meet_url        = excluded.meet_url,
               google_event_id = excluded.google_event_id;
    end if;
end;
$$;

revoke execute on function public.fn_attach_calendar_event(uuid, text, text) from public;
grant execute on function public.fn_attach_calendar_event(uuid, text, text) to service_role;

comment on function public.fn_attach_calendar_event is
    '予約に Calendar event ID / Meet URL を後付けする RPC (Server Action から呼ぶ)';
