-- =====================================================
-- Stripe 決済関連の追加カラム & RPC
--
-- 設計書 F036 / F037 / Q010 / TC009 / TC010
--
-- 1. customers.stripe_customer_id を追加（Customer Portal 用、決済 metadata 整合用）
-- 2. fn_grant_customer_ticket - webhook が atomic でチケット付与
-- 3. fn_apply_payment_fee - balance_transaction から取得した実手数料を payments に反映
-- =====================================================

-- =====================================================
-- 1. customers.stripe_customer_id
-- =====================================================
alter table public.customers
    add column if not exists stripe_customer_id text;

create unique index if not exists customers_stripe_customer_uniq
    on public.customers (stripe_customer_id)
    where stripe_customer_id is not null;

comment on column public.customers.stripe_customer_id is 'Stripe Customer ID (cus_xxx). Customer Portal や履歴管理に利用';

-- =====================================================
-- 2. fn_grant_customer_ticket
--
-- Stripe webhook (checkout.session.completed) からのみ呼ばれる。
-- payments INSERT + customer_tickets INSERT を1 transaction で実行。
-- 既に同じ stripe_session_id があれば payment_id をそのまま返す（冪等性）。
--
-- 引数:
--   p_customer_id        : 顧客 ID
--   p_ticket_id          : チケット商品 ID
--   p_stripe_session_id  : Stripe Checkout Session ID
--   p_stripe_pi_id       : Payment Intent ID
--   p_amount             : 決済金額（円）
--   p_currency           : デフォルト 'jpy'
--   p_metadata           : 任意の追加情報
--
-- 戻り値:
--   payment_id, customer_ticket_id, already_processed (boolean)
-- =====================================================
create or replace function public.fn_grant_customer_ticket(
    p_customer_id        uuid,
    p_ticket_id          uuid,
    p_stripe_session_id  text,
    p_stripe_pi_id       text,
    p_amount             integer,
    p_currency           text default 'jpy',
    p_metadata           jsonb default '{}'::jsonb
)
returns table (
    payment_id           uuid,
    customer_ticket_id   uuid,
    already_processed    boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing_payment  public.payments;
    v_ticket            public.tickets;
    v_payment_id        uuid;
    v_customer_ticket_id uuid;
    v_expires_at        timestamptz;
begin
    -- 冪等性: 既に処理済みなら何もしない
    select * into v_existing_payment
      from public.payments
     where stripe_session_id = p_stripe_session_id;

    if found then
        if v_existing_payment.status = 'paid' then
            -- 関連する customer_ticket を返す
            select id into v_customer_ticket_id
              from public.customer_tickets
             where payment_id = v_existing_payment.id
             limit 1;
            return query select v_existing_payment.id, v_customer_ticket_id, true;
            return;
        end if;
        -- pending を paid に更新
        update public.payments
           set status = 'paid',
               stripe_payment_intent_id = p_stripe_pi_id,
               amount = p_amount,
               currency = p_currency,
               metadata = p_metadata,
               updated_at = now()
         where id = v_existing_payment.id;
        v_payment_id := v_existing_payment.id;
    else
        -- 新規 payment INSERT
        insert into public.payments (
            customer_id, ticket_id, stripe_session_id, stripe_payment_intent_id,
            amount, currency, status, metadata
        ) values (
            p_customer_id, p_ticket_id, p_stripe_session_id, p_stripe_pi_id,
            p_amount, p_currency, 'paid', p_metadata
        ) returning id into v_payment_id;
    end if;

    -- チケット情報取得
    select * into v_ticket
      from public.tickets
     where id = p_ticket_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'ticket_not_found';
    end if;

    v_expires_at := now() + (v_ticket.valid_days || ' days')::interval;

    -- customer_tickets INSERT (UNIQUE は無い、毎回新規)
    insert into public.customer_tickets (
        customer_id, ticket_id, payment_id,
        remaining_count, initial_count,
        purchased_at, expires_at, status
    ) values (
        p_customer_id, p_ticket_id, v_payment_id,
        v_ticket.session_count, v_ticket.session_count,
        now(), v_expires_at, 'active'
    ) returning id into v_customer_ticket_id;

    -- audit_logs
    insert into public.audit_logs (
        actor_profile_id, actor_role, action, target_table, target_id, after_data
    ) values (
        (select profile_id from public.customers where id = p_customer_id),
        'customer',
        'ticket.purchased',
        'customer_tickets',
        v_customer_ticket_id,
        jsonb_build_object(
            'ticket_id', p_ticket_id,
            'amount', p_amount,
            'stripe_session_id', p_stripe_session_id
        )
    );

    return query select v_payment_id, v_customer_ticket_id, false;
end;
$$;

revoke execute on function public.fn_grant_customer_ticket(
    uuid, uuid, text, text, integer, text, jsonb
) from public;
grant execute on function public.fn_grant_customer_ticket(
    uuid, uuid, text, text, integer, text, jsonb
) to service_role;

comment on function public.fn_grant_customer_ticket is
    'Stripe webhook から呼ぶ atomic 関数。payments + customer_tickets を作成。stripe_session_id で冪等。';

-- =====================================================
-- 3. fn_apply_payment_fee
--
-- balance_transaction から取得した Stripe 実手数料を payments に反映 (Q010)
-- =====================================================
create or replace function public.fn_apply_payment_fee(
    p_payment_id        uuid,
    p_stripe_charge_id  text,
    p_stripe_fee        integer,
    p_net_amount        integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.payments
       set stripe_charge_id = p_stripe_charge_id,
           stripe_fee = p_stripe_fee,
           net_amount = p_net_amount,
           updated_at = now()
     where id = p_payment_id;
end;
$$;

revoke execute on function public.fn_apply_payment_fee(uuid, text, integer, integer) from public;
grant execute on function public.fn_apply_payment_fee(uuid, text, integer, integer) to service_role;

comment on function public.fn_apply_payment_fee is
    'Stripe balance_transaction から実手数料を取得して payments に保存 (Q010)';
