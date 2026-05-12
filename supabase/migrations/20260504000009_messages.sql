-- =====================================================
-- message_threads / messages テーブル
-- 顧客 ↔ 講師（予約済みのみ）/ 顧客 ↔ 管理者 / 講師 ↔ 管理者
-- 管理者は全スレッド閲覧可 (F017 / Q015)
-- =====================================================

create table public.message_threads (
    id            uuid                       primary key default gen_random_uuid(),
    thread_type   public.message_thread_type not null,
    customer_id   uuid                       references public.customers(id) on delete cascade,
    instructor_id uuid                       references public.instructors(id) on delete cascade,
    last_message_at timestamptz,
    -- 講師⇔顧客スレッドはどの予約をきっかけに作成されたかを記録（任意）
    seed_reservation_id uuid                 references public.reservations(id) on delete set null,
    created_at    timestamptz                not null default now(),
    updated_at    timestamptz                not null default now()
);

-- スレッドタイプに応じた必須カラムチェック
alter table public.message_threads
    add constraint mt_required_participants check (
        case thread_type
            when 'admin_customer'      then customer_id   is not null and instructor_id is null
            when 'instructor_customer' then customer_id   is not null and instructor_id is not null
            when 'admin_instructor'    then customer_id   is null     and instructor_id is not null
        end
    );

create unique index mt_unique_admin_customer
    on public.message_threads (customer_id)
    where thread_type = 'admin_customer';
create unique index mt_unique_instructor_customer
    on public.message_threads (customer_id, instructor_id)
    where thread_type = 'instructor_customer';
create unique index mt_unique_admin_instructor
    on public.message_threads (instructor_id)
    where thread_type = 'admin_instructor';

create index mt_last_message_idx on public.message_threads (last_message_at desc);

comment on table public.message_threads is 'メッセージスレッド。タイプ別に参加者構成が異なる (Q015)';

-- =====================================================
-- messages
-- =====================================================

create table public.messages (
    id                 uuid        primary key default gen_random_uuid(),
    thread_id          uuid        not null references public.message_threads(id) on delete cascade,
    sender_profile_id  uuid        not null references public.profiles(id) on delete restrict,
    body               text        not null,
    read_at_by_admin   timestamptz,
    read_at_by_other   timestamptz,
    created_at         timestamptz not null default now()
);

alter table public.messages
    add constraint msg_body_not_blank check (length(trim(body)) > 0);

create index msg_thread_idx     on public.messages (thread_id, created_at desc);
create index msg_sender_idx     on public.messages (sender_profile_id);

comment on table public.messages is 'メッセージ本文。XSS対策はアプリ層で escape (API024)';

-- スレッドの last_message_at をメッセージ追加時に更新
create or replace function public.fn_touch_thread_last_message()
returns trigger
language plpgsql
as $$
begin
    update public.message_threads
       set last_message_at = new.created_at,
           updated_at      = new.created_at
     where id = new.thread_id;
    return new;
end;
$$;

create trigger trg_touch_thread_last_message
after insert on public.messages
for each row execute function public.fn_touch_thread_last_message();
