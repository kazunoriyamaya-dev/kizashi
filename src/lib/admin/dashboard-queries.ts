/**
 * 管理者ダッシュボード用 KPI クエリ
 *
 * 設計書 A002:
 *  - 講師人数 (active のみ)
 *  - 顧客数
 *  - チケット売上 (枚数 / 金額)
 *  - 予約数
 *
 * Phase 3 実装範囲:
 *  - 全期間の集計
 *  - 期間絞り込みは Phase 12 で別途追加
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface AdminDashboardKpi {
  instructorCount: number;
  customerCount: number;
  ticketSoldCount: number;
  ticketSoldAmount: number;
  reservationCount: number;
  upcomingReservationCount: number;
  pendingTrialReviewCount: number;
}

export async function fetchAdminDashboardKpi(): Promise<AdminDashboardKpi> {
  const supabase = createSupabaseServerClient();

  const [instructors, customers, payments, reservations, upcoming, trials] = await Promise.all([
    supabase
      .from('instructors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('amount', { count: 'exact' }).eq('status', 'paid'),
    supabase.from('reservations').select('id', { count: 'exact', head: true }),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('start_at', new Date().toISOString())
      .in('status', ['pending_payment', 'confirmed', 'changed']),
    supabase
      .from('trial_pending_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  if (instructors.error) logger.error('kpi instructors failed', { code: instructors.error.code });
  if (customers.error) logger.error('kpi customers failed', { code: customers.error.code });
  if (payments.error) logger.error('kpi payments failed', { code: payments.error.code });
  if (reservations.error)
    logger.error('kpi reservations failed', { code: reservations.error.code });

  const ticketSoldAmount = payments.data?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;

  return {
    instructorCount: instructors.count ?? 0,
    customerCount: customers.count ?? 0,
    ticketSoldCount: payments.count ?? 0,
    ticketSoldAmount,
    reservationCount: reservations.count ?? 0,
    upcomingReservationCount: upcoming.count ?? 0,
    pendingTrialReviewCount: trials.count ?? 0,
  };
}
