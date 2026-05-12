-- =====================================================
-- cancel_policies テーブル
-- キャンセル/変更ポリシー（管理者が編集）
-- Q013 補足: 開始時刻の1時間前まで無料キャンセル/変更
-- Q013: チケットの返金は半額 - 返金手数料、弊社都合は全額返金
-- 適用は最新のレコード1件 (history は audit_logs で追う)
-- =====================================================

create table public.cancel_policies (
    id                                uuid        primary key default gen_random_uuid(),

    -- 1時間前無料キャンセル/変更 (Q013)
    free_cancel_minutes_before_start  integer     not null default 60,
    free_change_minutes_before_start  integer     not null default 60,

    -- 既存運用（後続 phase で参照）
    change_deadline_hours             integer     not null default 24,
    cancel_deadline_hours             integer     not null default 24,

    -- 期限内キャンセル時のチケット返却ルール
    -- 'full_return'      : チケット残数を完全に戻す
    -- 'half_refund_fee'  : Q013 弊社都合外: 半額 - 返金手数料
    -- 'no_return'        : チケット返却なし（消化扱い）
    ticket_return_rule_in_deadline    text        not null default 'full_return',

    -- 期限後キャンセル時のチケット返却ルール
    ticket_return_rule_out_deadline   text        not null default 'no_return',

    -- 弊社都合・講師都合キャンセル時のルール（Q014: チケット消化なし）
    ticket_return_rule_company        text        not null default 'full_return',
    ticket_return_rule_instructor     text        not null default 'full_return',

    -- 適用日時
    effective_from                    timestamptz not null default now(),

    -- 監査
    updated_by                        uuid        references public.profiles(id) on delete set null,

    created_at                        timestamptz not null default now(),
    updated_at                        timestamptz not null default now()
);

alter table public.cancel_policies
    add constraint cp_free_cancel_pos check (free_cancel_minutes_before_start >= 0),
    add constraint cp_free_change_pos check (free_change_minutes_before_start >= 0),
    add constraint cp_chg_dl_pos      check (change_deadline_hours >= 0),
    add constraint cp_cnl_dl_pos      check (cancel_deadline_hours >= 0),
    add constraint cp_rule_in_chk
        check (ticket_return_rule_in_deadline  in ('full_return', 'half_refund_fee', 'no_return')),
    add constraint cp_rule_out_chk
        check (ticket_return_rule_out_deadline in ('full_return', 'half_refund_fee', 'no_return')),
    add constraint cp_rule_co_chk
        check (ticket_return_rule_company      in ('full_return', 'half_refund_fee', 'no_return')),
    add constraint cp_rule_in_chk2
        check (ticket_return_rule_instructor   in ('full_return', 'half_refund_fee', 'no_return'));

create index cp_effective_idx on public.cancel_policies (effective_from desc);

comment on table  public.cancel_policies                                 is 'キャンセル/変更ポリシー (F016)。最新レコード(MAX effective_from)が現行ルール';
comment on column public.cancel_policies.free_cancel_minutes_before_start is '無料キャンセル可能な開始時刻からの分数 (Q013: default 60)';
