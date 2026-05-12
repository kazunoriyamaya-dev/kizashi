-- =====================================================
-- 予約 キャンセル / 変更 RPC
--
-- 設計書 F032/F033 + Q013/Q014:
--  - キャンセル理由: customer / company / instructor
--  - ticket_return_rule で full_return / half_refund_fee / no_return を分岐
--  - 変更: 時間枠を別の時間に移動。EXCLUDE 制約再検証
--  - 体験予約のキャンセル時は children.trial_used を false に戻す
-- =====================================================

-- =====================================================
-- 1. fn_cancel_reservation
--
-- 入力:
--   p_reservation_id      : 予約 ID
--   p_actor_profile_id    : 操作者のprofile_id (customer/admin/講師)
--   p_actor_role          : 'customer' | 'admin' | 'instructor'
--   p_cancel_reason       : 'customer' | 'company' | 'instructor'
--   p_ticket_return_rule  : 'full_return' | 'half_refund_fee' | 'no_return'
--   p_cancel_note         : メモ（任意）
--
-- 動作:
--   1. 予約取得 + 検証 (status が cancelled/completed なら不可)
--   2. status='cancelled', cancel_reason, cancel_note 更新
--   3. ticket_return_rule に応じてチケット残数を増減
--   4. trial 予約の場合 children.trial_used を false に戻す
--   5. audit_logs 記録
-- =====================================================
create or replace function public.fn_cancel_reservation(
    p_reservation_id     uuid,
    p_actor_profile_id   uuid,
    p_actor_role         public.role,
    p_cancel_reason      public.cancel_reason,
    p_ticket_return_rule text,
    p_cancel_note        text default null
)
returns table (
    reservation_id    uuid,
    ticket_returned   boolean,
    refund_amount     integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rsv         public.reservations;
    v_ct          public.customer_tickets;
    v_returned    boolean := false;
    v_refund      integer := 0;
begin
    select * into v_rsv
      from public.reservations
     where id = p_reservation_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'reservation_not_found';
    end if;
    if v_rsv.status in ('cancelled', 'completed') then
        raise exception using errcode = 'P0001', message = 'reservation_already_finalized';
    end if;

    -- ステータス更新
    update public.reservations
       set status        = 'cancelled',
           cancel_reason = p_cancel_reason,
           cancel_note   = p_cancel_note,
           cancelled_at  = now(),
           updated_at    = now()
     where id = p_reservation_id;

    -- チケット返却処理 (通常予約のみ。trial は customer_ticket_id IS NULL)
    if v_rsv.customer_ticket_id is not null then
        select * into v_ct
          from public.customer_tickets
         where id = v_rsv.customer_ticket_id
         for update;

        if p_ticket_return_rule = 'full_return' then
            update public.customer_tickets
               set remaining_count = remaining_count + 1,
                   status          = case when status = 'used' and remaining_count + 1 > 0 then 'active' else status end,
                   updated_at      = now()
             where id = v_ct.id;
            v_returned := true;
        elsif p_ticket_return_rule = 'half_refund_fee' then
            -- チケットは返却せず（消化扱い）、半額返金は Stripe 側で別途実施
            v_returned := false;
            -- 後段の Server Action で Stripe Refund を呼んで refund_amount を確定
        elsif p_ticket_return_rule = 'no_return' then
            v_returned := false;
        else
            raise exception using errcode = 'P0001', message = 'invalid_ticket_return_rule';
        end if;
    end if;

    -- trial 予約のキャンセル → children.trial_used を false に戻す
    if v_rsv.reservation_type = 'trial' then
        update public.children
           set trial_used = false,
               updated_at = now()
         where id = v_rsv.child_id;
    end if;

    -- audit_logs
    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, before_data, after_data, note
    ) values (
        p_actor_profile_id, p_actor_role, 'reservation.cancelled',
        'reservations', p_reservation_id,
        jsonb_build_object('status', v_rsv.status),
        jsonb_build_object(
            'status', 'cancelled',
            'reason', p_cancel_reason,
            'ticket_return_rule', p_ticket_return_rule,
            'ticket_returned', v_returned
        ),
        p_cancel_note
    );

    return query select p_reservation_id, v_returned, v_refund;
end;
$$;

revoke execute on function public.fn_cancel_reservation(uuid, uuid, public.role, public.cancel_reason, text, text) from public;
grant execute on function public.fn_cancel_reservation(uuid, uuid, public.role, public.cancel_reason, text, text)
    to authenticated, service_role;

comment on function public.fn_cancel_reservation is
    'F033/Q013/Q014: 予約キャンセル。理由とポリシーに応じてチケット返却を分岐';

-- =====================================================
-- 2. fn_change_reservation
--
-- 入力:
--   p_reservation_id   : 予約 ID
--   p_actor_profile_id : 操作者 profile_id
--   p_actor_role       : 操作者ロール
--   p_new_start_at     : 新しい開始時刻
--   p_new_end_at       : 新しい終了時刻
--   p_new_delivery_type: 新しい形式 (NULL なら変更なし)
--   p_new_location_address_id: 新しい場所 (NULL なら変更なし)
--
-- 動作:
--   1. 予約取得 + 検証
--   2. EXCLUDE 制約により他予約との重複は 23P01 で失敗
--   3. status='changed' に更新
--   4. reservation_changes に before/after を記録
--   5. audit_logs 記録
-- =====================================================
create or replace function public.fn_change_reservation(
    p_reservation_id          uuid,
    p_actor_profile_id        uuid,
    p_actor_role              public.role,
    p_new_start_at            timestamptz,
    p_new_end_at              timestamptz,
    p_new_delivery_type       public.delivery_type default null,
    p_new_location_address_id uuid default null
)
returns table (reservation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rsv public.reservations;
    v_before jsonb;
    v_after  jsonb;
begin
    select * into v_rsv
      from public.reservations
     where id = p_reservation_id
     for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'reservation_not_found';
    end if;
    if v_rsv.status in ('cancelled', 'completed', 'no_show') then
        raise exception using errcode = 'P0001', message = 'reservation_finalized';
    end if;
    if p_new_end_at <= p_new_start_at then
        raise exception using errcode = 'P0001', message = 'invalid_time_range';
    end if;

    v_before := jsonb_build_object(
        'start_at',           v_rsv.start_at,
        'end_at',             v_rsv.end_at,
        'delivery_type',      v_rsv.delivery_type,
        'location_address_id', v_rsv.location_address_id
    );

    update public.reservations
       set start_at            = p_new_start_at,
           end_at              = p_new_end_at,
           duration_min        = extract(epoch from (p_new_end_at - p_new_start_at))::integer / 60,
           delivery_type       = coalesce(p_new_delivery_type, v_rsv.delivery_type),
           location_address_id = coalesce(p_new_location_address_id, v_rsv.location_address_id),
           status              = 'changed',
           updated_at          = now()
     where id = p_reservation_id;

    v_after := jsonb_build_object(
        'start_at',           p_new_start_at,
        'end_at',             p_new_end_at,
        'delivery_type',      coalesce(p_new_delivery_type, v_rsv.delivery_type),
        'location_address_id', coalesce(p_new_location_address_id, v_rsv.location_address_id)
    );

    insert into public.reservation_changes (
        reservation_id, actor_profile_id, change_type, before_data, after_data
    ) values (
        p_reservation_id, p_actor_profile_id, 'time_changed', v_before, v_after
    );

    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, before_data, after_data
    ) values (
        p_actor_profile_id, p_actor_role, 'reservation.changed', 'reservations', p_reservation_id, v_before, v_after
    );

    return query select p_reservation_id;
end;
$$;

revoke execute on function public.fn_change_reservation(uuid, uuid, public.role, timestamptz, timestamptz, public.delivery_type, uuid) from public;
grant execute on function public.fn_change_reservation(uuid, uuid, public.role, timestamptz, timestamptz, public.delivery_type, uuid)
    to authenticated, service_role;

comment on function public.fn_change_reservation is
    'F032: 予約時間/形式/場所の変更。EXCLUDE 制約再評価で時間衝突を防ぐ';
