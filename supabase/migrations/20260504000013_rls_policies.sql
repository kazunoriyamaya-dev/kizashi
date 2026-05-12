-- =====================================================
-- RLS ポリシー（全テーブル）
-- 設計書 04_DB_RLS設計に準拠
--
-- 基本方針:
-- - 全テーブルで ENABLE ROW LEVEL SECURITY
-- - admin: 全件 (fn_is_admin())
-- - instructor: 自分の予約・参加スレッドに紐付くもののみ
-- - customer: 自分の情報、子供、チケット、予約のみ
-- - service role はバイパス（webhook/Cron/管理処理）
-- =====================================================

-- =====================================================
-- profiles
-- =====================================================
alter table public.profiles enable row level security;

create policy profiles_select_self_or_admin
    on public.profiles for select
    using (id = auth.uid() or public.fn_is_admin());

-- 表示名・電話番号などは本人または admin が更新可能
create policy profiles_update_self_or_admin
    on public.profiles for update
    using (id = auth.uid() or public.fn_is_admin())
    with check (id = auth.uid() or public.fn_is_admin());

-- INSERT は SECURITY DEFINER のトリガー fn_handle_new_user 経由のみ
-- （anon ロールから直接 INSERT 不可）
-- DELETE は admin のみ（論理削除推奨だが、緊急時の物理削除可能性のため許可）
create policy profiles_delete_admin_only
    on public.profiles for delete
    using (public.fn_is_admin());

-- =====================================================
-- addresses
-- 顧客は自分(customer配下)、講師は自分(instructor配下)、admin は全件
-- =====================================================
alter table public.addresses enable row level security;

create policy addresses_select
    on public.addresses for select
    using (
        public.fn_is_admin()
        or (owner_type = 'customer'   and owner_id = public.fn_current_customer_id())
        or (owner_type = 'instructor' and owner_id = public.fn_current_instructor_id())
        or (owner_type = 'reservation_location' and exists (
            select 1 from public.reservations r
             where r.location_address_id = public.addresses.id
               and (
                   r.customer_id   = public.fn_current_customer_id()
                or r.instructor_id = public.fn_current_instructor_id()
                or public.fn_is_admin()
               )
        ))
    );

create policy addresses_modify_owner
    on public.addresses for all
    using (
        public.fn_is_admin()
        or (owner_type = 'customer'   and owner_id = public.fn_current_customer_id())
        or (owner_type = 'instructor' and owner_id = public.fn_current_instructor_id())
    )
    with check (
        public.fn_is_admin()
        or (owner_type = 'customer'   and owner_id = public.fn_current_customer_id())
        or (owner_type = 'instructor' and owner_id = public.fn_current_instructor_id())
    );

-- =====================================================
-- customers
-- 顧客本人 + admin。講師は自分の担当予約に紐付く顧客のみ最小列を SELECT
-- 直接 SELECT は許可せず、サーバー側関数経由で取得 (TC005)
-- =====================================================
alter table public.customers enable row level security;

create policy customers_select_self_or_admin
    on public.customers for select
    using (profile_id = auth.uid() or public.fn_is_admin());

create policy customers_update_self_or_admin
    on public.customers for update
    using (profile_id = auth.uid() or public.fn_is_admin())
    with check (profile_id = auth.uid() or public.fn_is_admin());

-- INSERT は fn_handle_new_user (auth trigger) 経由のみ
create policy customers_insert_admin_only
    on public.customers for insert
    with check (public.fn_is_admin());

create policy customers_delete_admin_only
    on public.customers for delete
    using (public.fn_is_admin());

-- =====================================================
-- children
-- 親 (customer) または admin のみ
-- =====================================================
alter table public.children enable row level security;

create policy children_owner_only
    on public.children for all
    using (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    )
    with check (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    );

-- =====================================================
-- instructors
-- 公開列は誰でも (active のみ)
-- 非公開列含む全件は admin と本人のみ
-- ⇒ ベーステーブルは 本人 + admin、公開閲覧は instructors_public ビュー経由 (Q018)
-- =====================================================
alter table public.instructors enable row level security;

-- 本人 + admin が全件参照可能
-- 顧客は base table を直接 SELECT 不可。代わりに instructors_public ビューを利用する
-- (ビューは security_invoker=false でオーナー権限で実行され、status='active' でフィルタ済み)
create policy instructors_select_self_or_admin
    on public.instructors for select
    using (profile_id = auth.uid() or public.fn_is_admin());

create policy instructors_modify_self_or_admin
    on public.instructors for update
    using (profile_id = auth.uid() or public.fn_is_admin())
    with check (profile_id = auth.uid() or public.fn_is_admin());

create policy instructors_admin_insert
    on public.instructors for insert
    with check (public.fn_is_admin());

create policy instructors_admin_delete
    on public.instructors for delete
    using (public.fn_is_admin());

-- =====================================================
-- calendar_connections
-- 本人講師 + admin
-- =====================================================
alter table public.calendar_connections enable row level security;

create policy calendar_connections_self_or_admin
    on public.calendar_connections for all
    using (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    )
    with check (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    );

-- =====================================================
-- stripe_connect_accounts
-- 本人講師 + admin
-- =====================================================
alter table public.stripe_connect_accounts enable row level security;

create policy stripe_connect_self_or_admin
    on public.stripe_connect_accounts for select
    using (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    );

-- INSERT/UPDATE/DELETE は service_role のみ（webhook 経由）
-- service_role は RLS をバイパスするため明示的に空の write ポリシーは不要
-- ただし誤って anon で操作されないよう、明示的に admin のみ許可
create policy stripe_connect_admin_modify
    on public.stripe_connect_accounts for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- invoice_settings
-- 本人講師 + admin
-- =====================================================
alter table public.invoice_settings enable row level security;

create policy invoice_settings_self_or_admin
    on public.invoice_settings for all
    using (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    )
    with check (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    );

-- =====================================================
-- tickets
-- active は誰でも SELECT 可。INSERT/UPDATE/DELETE は admin のみ
-- =====================================================
alter table public.tickets enable row level security;

create policy tickets_select_active_or_admin
    on public.tickets for select
    using (status = 'active' or public.fn_is_admin());

create policy tickets_admin_modify
    on public.tickets for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- customer_tickets
-- 本人 + admin
-- INSERT/UPDATE は webhook (service_role) もしくは admin のみ
-- =====================================================
alter table public.customer_tickets enable row level security;

create policy ct_select_self_or_admin
    on public.customer_tickets for select
    using (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    );

create policy ct_admin_modify
    on public.customer_tickets for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- payments
-- 本人 + admin が SELECT、INSERT/UPDATE は service_role のみ
-- =====================================================
alter table public.payments enable row level security;

create policy payments_select_self_or_admin
    on public.payments for select
    using (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    );

create policy payments_admin_modify
    on public.payments for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- stripe_webhook_events
-- admin のみ閲覧、INSERT は service_role
-- =====================================================
alter table public.stripe_webhook_events enable row level security;

create policy swe_admin_select
    on public.stripe_webhook_events for select
    using (public.fn_is_admin());

create policy swe_admin_modify
    on public.stripe_webhook_events for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- cancel_policies
-- SELECT 全員（顧客にも表示）、UPDATE/INSERT/DELETE は admin
-- =====================================================
alter table public.cancel_policies enable row level security;

create policy cp_read_all
    on public.cancel_policies for select
    using (true);

create policy cp_admin_modify
    on public.cancel_policies for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- reservations
-- 顧客本人 + 担当講師 + admin
-- INSERT は本人または admin、確定処理は server function 経由
-- =====================================================
alter table public.reservations enable row level security;

create policy rsv_select_participant_or_admin
    on public.reservations for select
    using (
        public.fn_is_admin()
        or customer_id   = public.fn_current_customer_id()
        or instructor_id = public.fn_current_instructor_id()
    );

create policy rsv_insert_self_or_admin
    on public.reservations for insert
    with check (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    );

create policy rsv_update_participant_or_admin
    on public.reservations for update
    using (
        public.fn_is_admin()
        or customer_id   = public.fn_current_customer_id()
        or instructor_id = public.fn_current_instructor_id()
    )
    with check (
        public.fn_is_admin()
        or customer_id   = public.fn_current_customer_id()
        or instructor_id = public.fn_current_instructor_id()
    );

-- DELETE は admin のみ（論理削除 = status='cancelled' を推奨）
create policy rsv_delete_admin_only
    on public.reservations for delete
    using (public.fn_is_admin());

-- =====================================================
-- travel_fees
-- 関連予約の参加者 + admin
-- =====================================================
alter table public.travel_fees enable row level security;

create policy tf_select_participant_or_admin
    on public.travel_fees for select
    using (
        public.fn_is_admin()
        or exists (
            select 1 from public.reservations r
             where r.id = public.travel_fees.reservation_id
               and (
                   r.customer_id   = public.fn_current_customer_id()
                or r.instructor_id = public.fn_current_instructor_id()
               )
        )
    );

create policy tf_admin_modify
    on public.travel_fees for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- reservation_changes
-- 予約参加者 + admin が SELECT
-- INSERT は server (admin) のみ
-- =====================================================
alter table public.reservation_changes enable row level security;

create policy rc_select_participant_or_admin
    on public.reservation_changes for select
    using (
        public.fn_is_admin()
        or exists (
            select 1 from public.reservations r
             where r.id = public.reservation_changes.reservation_id
               and (
                   r.customer_id   = public.fn_current_customer_id()
                or r.instructor_id = public.fn_current_instructor_id()
               )
        )
    );

create policy rc_admin_insert
    on public.reservation_changes for insert
    with check (public.fn_is_admin());

-- =====================================================
-- trial_pending_reviews
-- 本人 + admin
-- =====================================================
alter table public.trial_pending_reviews enable row level security;

create policy tpr_self_or_admin
    on public.trial_pending_reviews for select
    using (
        public.fn_is_admin()
        or customer_id = public.fn_current_customer_id()
    );

create policy tpr_admin_modify
    on public.trial_pending_reviews for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- google_meet_links
-- 関連予約の参加者 + admin が SELECT
-- INSERT/UPDATE は server (admin) のみ
-- =====================================================
alter table public.google_meet_links enable row level security;

create policy gml_select_participant_or_admin
    on public.google_meet_links for select
    using (
        public.fn_is_admin()
        or exists (
            select 1 from public.reservations r
             where r.id = public.google_meet_links.reservation_id
               and (
                   r.customer_id   = public.fn_current_customer_id()
                or r.instructor_id = public.fn_current_instructor_id()
               )
        )
    );

create policy gml_admin_modify
    on public.google_meet_links for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- message_threads
-- 参加者 + admin が SELECT
-- INSERT は本人（customer/instructor）または admin
-- =====================================================
alter table public.message_threads enable row level security;

create policy mt_select_participant_or_admin
    on public.message_threads for select
    using (
        public.fn_is_admin()
        or customer_id   = public.fn_current_customer_id()
        or instructor_id = public.fn_current_instructor_id()
    );

create policy mt_insert_participant_or_admin
    on public.message_threads for insert
    with check (
        public.fn_is_admin()
        or customer_id   = public.fn_current_customer_id()
        or instructor_id = public.fn_current_instructor_id()
    );

create policy mt_update_admin_only
    on public.message_threads for update
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

create policy mt_delete_admin_only
    on public.message_threads for delete
    using (public.fn_is_admin());

-- =====================================================
-- messages
-- スレッド参加者 + admin が SELECT/INSERT
-- =====================================================
alter table public.messages enable row level security;

create policy msg_select_participant_or_admin
    on public.messages for select
    using (
        public.fn_is_admin()
        or exists (
            select 1 from public.message_threads t
             where t.id = public.messages.thread_id
               and (
                   t.customer_id   = public.fn_current_customer_id()
                or t.instructor_id = public.fn_current_instructor_id()
               )
        )
    );

create policy msg_insert_participant_or_admin
    on public.messages for insert
    with check (
        sender_profile_id = auth.uid()
        and (
            public.fn_is_admin()
            or exists (
                select 1 from public.message_threads t
                 where t.id = public.messages.thread_id
                   and (
                       t.customer_id   = public.fn_current_customer_id()
                    or t.instructor_id = public.fn_current_instructor_id()
                   )
            )
        )
    );

-- メッセージは編集・削除不可（監査用途、Q020 退会後も保持）
-- = UPDATE/DELETE ポリシーを作らない = 全拒否

-- =====================================================
-- payouts
-- 本人(instructor) + admin が SELECT、INSERT/UPDATE は admin のみ
-- =====================================================
alter table public.payouts enable row level security;

create policy po_select_self_or_admin
    on public.payouts for select
    using (
        public.fn_is_admin()
        or instructor_id = public.fn_current_instructor_id()
    );

create policy po_admin_modify
    on public.payouts for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- audit_logs
-- admin のみ SELECT
-- INSERT は server (service_role) のみ。anon/authenticated は不可
-- UPDATE/DELETE は trigger fn_audit_logs_immutable で全拒否
-- =====================================================
alter table public.audit_logs enable row level security;

create policy al_admin_select
    on public.audit_logs for select
    using (public.fn_is_admin());

-- INSERT は admin もしくは service_role(RLS バイパス)
create policy al_admin_insert
    on public.audit_logs for insert
    with check (public.fn_is_admin());

-- =====================================================
-- email/line/push notification logs
-- 本人 + admin が SELECT、INSERT は service_role のみ
-- =====================================================
alter table public.email_notification_logs enable row level security;
create policy enl_select_self_or_admin
    on public.email_notification_logs for select
    using (
        public.fn_is_admin()
        or target_profile_id = auth.uid()
    );
create policy enl_admin_modify
    on public.email_notification_logs for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

alter table public.line_notification_logs enable row level security;
create policy lnl_select_self_or_admin
    on public.line_notification_logs for select
    using (
        public.fn_is_admin()
        or target_profile_id = auth.uid()
    );
create policy lnl_admin_modify
    on public.line_notification_logs for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

alter table public.push_notification_logs enable row level security;
create policy pnl_select_self_or_admin
    on public.push_notification_logs for select
    using (
        public.fn_is_admin()
        or target_profile_id = auth.uid()
    );
create policy pnl_admin_modify
    on public.push_notification_logs for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- push_subscriptions
-- 本人 + admin
-- =====================================================
alter table public.push_subscriptions enable row level security;

create policy ps_self_or_admin
    on public.push_subscriptions for all
    using (
        public.fn_is_admin()
        or profile_id = auth.uid()
    )
    with check (
        public.fn_is_admin()
        or profile_id = auth.uid()
    );

-- =====================================================
-- system_settings
-- SELECT は全員（指名料表示等で参照）、UPDATE/INSERT は admin のみ
-- =====================================================
alter table public.system_settings enable row level security;

create policy ss_read_all
    on public.system_settings for select
    using (true);

create policy ss_admin_modify
    on public.system_settings for all
    using (public.fn_is_admin())
    with check (public.fn_is_admin());

-- =====================================================
-- 公開ビューの権限
-- =====================================================
-- instructors_public は誰でも参照可能（ベーステーブルの RLS で active のみに絞られる）
grant select on public.instructors_public to anon, authenticated;
