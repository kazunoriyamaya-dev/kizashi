-- =====================================================
-- enum 型定義
-- 設計書 04_DB_RLS設計 + QA回答（Q001/Q018/Q023）反映
-- =====================================================

-- ロール（Q017: admin/instructor/customer の3種のみ）
create type public.role as enum ('admin', 'instructor', 'customer');

-- プロフィール / 講師 ステータス
create type public.profile_status as enum ('invited', 'active', 'suspended', 'deleted');

-- カテゴリ（learning/sports/art の3種、designed in 01_要件定義）
create type public.category as enum ('learning', 'sports', 'art');

-- 講師ランク（Q023: 指名料の段階）
create type public.instructor_rank as enum ('gold', 'silver', 'bronze', 'regular');

-- 移動手段（電車・車）
create type public.transportation_mode as enum ('train', 'car');

-- レッスン形式（Q001: ペア対応）
create type public.lesson_format as enum ('solo', 'pair');

-- 提供形式（オンライン・対面）
create type public.delivery_type as enum ('online', 'onsite');

-- 予約タイプ（通常・体験）
create type public.reservation_type as enum ('normal', 'trial');

-- 予約ステータス
create type public.reservation_status as enum (
    'draft',           -- 仮作成（チケット消化前）
    'pending_payment', -- 決済待ち（チケット不足）
    'confirmed',       -- 確定済み
    'changed',         -- 変更済み（confirmedの後で変更された）
    'cancelled',       -- キャンセル
    'completed',       -- 実施完了
    'no_show'          -- 無断欠席
);

-- チケット商品ステータス
create type public.ticket_status as enum ('active', 'inactive', 'deleted');

-- 顧客保有チケット ステータス
create type public.customer_ticket_status as enum ('active', 'expired', 'used', 'cancelled');

-- 決済ステータス
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- 住所所有者種別
create type public.address_owner_type as enum (
    'customer',
    'instructor',
    'reservation_location'
);

-- メッセージスレッドタイプ
create type public.message_thread_type as enum ('admin_customer', 'instructor_customer', 'admin_instructor');

-- 講師精算ステータス
create type public.payout_status as enum ('draft', 'confirmed', 'paid', 'cancelled');

-- 通知チャネル
create type public.notification_channel as enum ('email', 'line', 'push');

-- 通知ステータス
create type public.notification_status as enum ('queued', 'sent', 'failed');

-- 体験予約 管理者確認ステータス（Q003）
create type public.trial_review_status as enum ('pending', 'approved', 'rejected');

-- ペア参加者の種類
create type public.pair_participant_type as enum ('child', 'free_text');

-- キャンセル理由（Q013/Q014）
create type public.cancel_reason as enum (
    'customer',  -- 生徒都合
    'company',   -- 弊社都合
    'instructor' -- 講師都合
);
