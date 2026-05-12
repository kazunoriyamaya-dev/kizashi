-- =====================================================
-- 月次精算 RPC (F018 / Q010 / Q011 / Q012)
--
-- フロー:
--  1. 管理者が「対象月の集計開始」ボタン押下
--  2. fn_compute_monthly_payouts(period_month, recompute=false) で集計
--     - 対象月の reservations.status='completed' を集計
--     - 各講師ごとに:
--         ticket_gross    = SUM(チケット消化分の単価)
--         stripe_fee      = SUM(対応する payments.stripe_fee × 按分)
--         designation_fee = SUM(reservations.designation_fee)
--         travel_fee      = SUM(travel_fees.amount)
--         instructor_amount = floor((ticket_gross - stripe_fee) * 0.5)
--                             + designation_fee + travel_fee
--     - 既存の draft があれば上書き、confirmed/paid は更新しない (recompute=true で上書き可)
--     - payouts UPSERT (instructor_id × period_month UNIQUE)
--  3. 管理者が個別レコードを 'confirmed' に進める
--  4. Stripe Connect で transfer 実行後、'paid' に
--
-- 引数 recompute:
--   false → 既に confirmed/paid なら skip
--   true  → 上書き (検証用)
-- =====================================================

create or replace function public.fn_compute_monthly_payouts(
    p_period_month date,
    p_recompute    boolean default false
)
returns table (
    instructor_id     uuid,
    payout_id         uuid,
    instructor_amount integer,
    status            public.payout_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period_month date := date_trunc('month', p_period_month)::date;
    v_period_start timestamptz := v_period_month;
    v_period_end   timestamptz := (v_period_month + interval '1 month');
    v_inst         record;
    v_existing     public.payouts;
    v_ticket_gross integer;
    v_stripe_fee   integer;
    v_design_fee   integer;
    v_travel_fee   integer;
    v_instructor_amount integer;
    v_invoice_no   text;
    v_payout_id    uuid;
    v_status       public.payout_status;
begin
    -- 対象月に予約のある講師を抽出
    for v_inst in
        select distinct r.instructor_id
          from public.reservations r
         where r.instructor_id is not null
           and r.status = 'completed'
           and r.start_at >= v_period_start
           and r.start_at <  v_period_end
    loop
        -- 既存 payout を取得
        select * into v_existing
          from public.payouts
         where instructor_id = v_inst.instructor_id
           and period_month  = v_period_month;

        if found and not p_recompute and v_existing.status in ('confirmed', 'paid') then
            -- 既に確定/支払い済みは skip
            instructor_id := v_inst.instructor_id;
            payout_id := v_existing.id;
            instructor_amount := v_existing.instructor_amount;
            status := v_existing.status;
            return next;
            continue;
        end if;

        -- 集計
        -- ticket_gross: 対象予約に消化されたチケットの単価合計
        select coalesce(sum(t.price), 0)
          into v_ticket_gross
          from public.reservations r
          join public.customer_tickets ct on ct.id = r.customer_ticket_id
          join public.tickets t on t.id = ct.ticket_id
         where r.instructor_id = v_inst.instructor_id
           and r.status = 'completed'
           and r.start_at >= v_period_start
           and r.start_at <  v_period_end;

        -- stripe_fee: 対応する payments.stripe_fee を チケット数で按分
        --  簡略実装: 対象月に紐づく payments の stripe_fee 合計を、その payment が抱えるチケット数で割り、
        --           消化数を掛ける (= 完全な按分)
        -- ただし MVP では payment.amount 全体に対する割合で按分
        select coalesce(
            sum(
                case
                    when p.amount > 0 and p.stripe_fee is not null
                    then floor(p.stripe_fee::numeric * t.price::numeric / p.amount::numeric)::integer
                    else 0
                end
            ),
            0
        )
          into v_stripe_fee
          from public.reservations r
          join public.customer_tickets ct on ct.id = r.customer_ticket_id
          join public.tickets t on t.id = ct.ticket_id
          join public.payments p on p.id = ct.payment_id
         where r.instructor_id = v_inst.instructor_id
           and r.status = 'completed'
           and r.start_at >= v_period_start
           and r.start_at <  v_period_end;

        -- designation_fee
        select coalesce(sum(r.designation_fee), 0)
          into v_design_fee
          from public.reservations r
         where r.instructor_id = v_inst.instructor_id
           and r.status = 'completed'
           and r.start_at >= v_period_start
           and r.start_at <  v_period_end;

        -- travel_fee
        select coalesce(sum(tf.amount), 0)
          into v_travel_fee
          from public.reservations r
          join public.travel_fees tf on tf.reservation_id = r.id
         where r.instructor_id = v_inst.instructor_id
           and r.status = 'completed'
           and r.start_at >= v_period_start
           and r.start_at <  v_period_end;

        -- 計算式: (ticket_gross - stripe_fee) × 50% + 指名料 + 交通費
        v_instructor_amount := floor((v_ticket_gross - v_stripe_fee) * 0.5)::integer
                             + v_design_fee + v_travel_fee;
        if v_instructor_amount < 0 then v_instructor_amount := 0; end if;

        -- インボイス番号スナップショット (Q012)
        select invoice_registration_no into v_invoice_no
          from public.invoice_settings
         where invoice_settings.instructor_id = v_inst.instructor_id;

        -- payouts UPSERT
        insert into public.payouts (
            instructor_id, period_month,
            gross_amount, stripe_fee_amount, designation_fee_amount, travel_fee_amount,
            instructor_amount,
            detail, status, invoice_registration_no
        ) values (
            v_inst.instructor_id, v_period_month,
            v_ticket_gross, v_stripe_fee, v_design_fee, v_travel_fee,
            v_instructor_amount,
            jsonb_build_object(
                'computed_at', now(),
                'ticket_gross', v_ticket_gross,
                'stripe_fee', v_stripe_fee,
                'designation_fee', v_design_fee,
                'travel_fee', v_travel_fee
            ),
            'draft', v_invoice_no
        )
        on conflict (instructor_id, period_month) do update
           set gross_amount           = excluded.gross_amount,
               stripe_fee_amount      = excluded.stripe_fee_amount,
               designation_fee_amount = excluded.designation_fee_amount,
               travel_fee_amount      = excluded.travel_fee_amount,
               instructor_amount      = excluded.instructor_amount,
               detail                 = excluded.detail,
               invoice_registration_no = excluded.invoice_registration_no,
               updated_at             = now()
         where payouts.status in ('draft')      -- confirmed/paid は p_recompute=false 時 skip 済み
           or p_recompute = true
        returning id, status into v_payout_id, v_status;

        if v_payout_id is null then
            -- conflict 後の where 条件で update がスキップされたケース
            select id, status into v_payout_id, v_status
              from public.payouts
             where instructor_id = v_inst.instructor_id
               and period_month = v_period_month;
        end if;

        instructor_id := v_inst.instructor_id;
        payout_id := v_payout_id;
        instructor_amount := v_instructor_amount;
        status := coalesce(v_status, 'draft');
        return next;
    end loop;

    return;
end;
$$;

revoke execute on function public.fn_compute_monthly_payouts(date, boolean) from public;
grant execute on function public.fn_compute_monthly_payouts(date, boolean) to service_role;

comment on function public.fn_compute_monthly_payouts is
    'F018: 月次精算集計。draft レコードを upsert。Q010(実Stripe手数料) + Q011(50%取り分) + Q012(インボイス番号)';

-- =====================================================
-- fn_confirm_payout: draft → confirmed
-- =====================================================
create or replace function public.fn_confirm_payout(
    p_payout_id        uuid,
    p_actor_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_payout public.payouts;
begin
    select * into v_payout from public.payouts where id = p_payout_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'payout_not_found';
    end if;
    if v_payout.status <> 'draft' then
        raise exception using errcode = 'P0001', message = 'payout_not_draft';
    end if;

    update public.payouts
       set status = 'confirmed',
           confirmed_at = now(),
           updated_at = now()
     where id = p_payout_id;

    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        p_actor_profile_id, 'admin', 'payout.confirmed',
        'payouts', p_payout_id,
        jsonb_build_object('amount', v_payout.instructor_amount)
    );
end;
$$;

revoke execute on function public.fn_confirm_payout(uuid, uuid) from public;
grant execute on function public.fn_confirm_payout(uuid, uuid) to service_role;

-- =====================================================
-- fn_mark_payout_paid: confirmed → paid (Stripe Transfer 完了後)
-- =====================================================
create or replace function public.fn_mark_payout_paid(
    p_payout_id          uuid,
    p_actor_profile_id   uuid,
    p_stripe_transfer_id text,
    p_stripe_payout_id   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_payout public.payouts;
begin
    select * into v_payout from public.payouts where id = p_payout_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'payout_not_found';
    end if;
    if v_payout.status not in ('confirmed') then
        raise exception using errcode = 'P0001', message = 'payout_not_confirmed';
    end if;

    update public.payouts
       set status = 'paid',
           paid_at = now(),
           stripe_transfer_id = p_stripe_transfer_id,
           stripe_payout_id = p_stripe_payout_id,
           updated_at = now()
     where id = p_payout_id;

    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        p_actor_profile_id, 'admin', 'payout.paid',
        'payouts', p_payout_id,
        jsonb_build_object(
            'amount', v_payout.instructor_amount,
            'transfer_id', p_stripe_transfer_id
        )
    );
end;
$$;

revoke execute on function public.fn_mark_payout_paid(uuid, uuid, text, text) from public;
grant execute on function public.fn_mark_payout_paid(uuid, uuid, text, text) to service_role;
