/**
 * GET /api/cron/sweep-expired-tickets
 *
 * 期限切れチケットを active → expired に状態遷移
 * (Phase 1 で実装済みの fn_sweep_expired_tickets を呼ぶ)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { isAuthorizedCron } from '@/lib/notifications/cron-auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('fn_sweep_expired_tickets');
  if (error) {
    return NextResponse.json({ error: error.code }, { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ updated: row?.updated_count ?? 0 });
}
