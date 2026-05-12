/**
 * 月次精算 計算ロジック
 *
 * - fn_compute_monthly_payouts RPC を呼ぶラッパー
 * - 集計結果を整形して返す
 * - 講師別に Stripe Connect 状態も付加して返す
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface PayoutComputeRowResult {
  instructorId: string;
  payoutId: string;
  instructorAmount: number;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
}

/**
 * 対象月の payouts を再集計
 *
 * @param periodMonthIso YYYY-MM-01 形式 (UTC date) を推奨
 * @param recompute true: confirmed/paid も上書き
 */
export async function computeMonthlyPayouts(
  periodMonthIso: string,
  recompute: boolean = false,
): Promise<PayoutComputeRowResult[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('fn_compute_monthly_payouts', {
    p_period_month: periodMonthIso,
    p_recompute: recompute,
  });

  if (error) {
    logger.error('compute monthly payouts failed', { code: error.code, detail: error.message });
    throw new Error(`compute_failed:${error.message}`);
  }

  return (data ?? []).map((r) => ({
    instructorId: r.instructor_id,
    payoutId: r.payout_id,
    instructorAmount: r.instructor_amount,
    status: r.status,
  }));
}

/**
 * payouts を講師情報と一緒に取得
 */
export interface PayoutDetail {
  id: string;
  instructorId: string;
  instructorNickname: string;
  instructorRealName: string;
  periodMonth: string;
  grossAmount: number;
  stripeFeeAmount: number;
  designationFeeAmount: number;
  travelFeeAmount: number;
  instructorAmount: number;
  status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  confirmedAt: string | null;
  paidAt: string | null;
  stripeTransferId: string | null;
  invoiceRegistrationNo: string | null;
  hasConnectAccount: boolean;
  payoutsEnabled: boolean;
}

export async function listPayouts(periodMonthIso: string): Promise<PayoutDetail[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('payouts')
    .select(
      `id, instructor_id, period_month, gross_amount, stripe_fee_amount,
       designation_fee_amount, travel_fee_amount, instructor_amount,
       status, confirmed_at, paid_at, stripe_transfer_id, invoice_registration_no,
       instructors!payouts_instructor_id_fkey ( nickname, real_name,
         stripe_connect_accounts ( payouts_enabled, onboarding_completed )
       )`,
    )
    .eq('period_month', periodMonthIso)
    .order('instructor_amount', { ascending: false });

  if (error) {
    logger.error('list payouts failed', { code: error.code });
    return [];
  }

  return (data ?? []).map((r) => {
    const connect = r.instructors?.stripe_connect_accounts?.[0];
    return {
      id: r.id,
      instructorId: r.instructor_id,
      instructorNickname: r.instructors?.nickname ?? '',
      instructorRealName: r.instructors?.real_name ?? '',
      periodMonth: r.period_month,
      grossAmount: r.gross_amount,
      stripeFeeAmount: r.stripe_fee_amount,
      designationFeeAmount: r.designation_fee_amount,
      travelFeeAmount: r.travel_fee_amount,
      instructorAmount: r.instructor_amount,
      status: r.status,
      confirmedAt: r.confirmed_at,
      paidAt: r.paid_at,
      stripeTransferId: r.stripe_transfer_id,
      invoiceRegistrationNo: r.invoice_registration_no,
      hasConnectAccount: !!connect,
      payoutsEnabled: !!connect?.payouts_enabled,
    };
  });
}

/**
 * 精算 CSV 文字列を生成 (UTF-8 BOM 付き、Excel 互換)
 */
export function payoutsToCsv(rows: PayoutDetail[]): string {
  const header = [
    '対象月',
    '講師ニックネーム',
    '本名',
    'インボイス番号',
    'チケット売上',
    'Stripe手数料',
    '指名料',
    '交通費',
    '講師取り分',
    'ステータス',
    '確定日',
    '支払日',
    'Stripe Transfer ID',
  ];
  const lines: string[] = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.periodMonth,
        escape(r.instructorNickname),
        escape(r.instructorRealName),
        escape(r.invoiceRegistrationNo ?? ''),
        r.grossAmount,
        r.stripeFeeAmount,
        r.designationFeeAmount,
        r.travelFeeAmount,
        r.instructorAmount,
        r.status,
        r.confirmedAt ? new Date(r.confirmedAt).toLocaleDateString('ja-JP') : '',
        r.paidAt ? new Date(r.paidAt).toLocaleDateString('ja-JP') : '',
        escape(r.stripeTransferId ?? ''),
      ].join(','),
    );
  }
  return '﻿' + lines.join('\n');
}

function escape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
