/**
 * API001 GET /api/admin/dashboard
 *
 * 管理者 KPI を JSON で返す。fetch から取得して dashboard 表示など。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchAdminDashboardKpi } from '@/lib/admin/dashboard-queries';

export async function GET() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const kpi = await fetchAdminDashboardKpi();
  return NextResponse.json(kpi);
}
