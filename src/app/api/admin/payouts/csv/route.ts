/**
 * GET /api/admin/payouts/csv?period=YYYY-MM
 *
 * 管理者向け 月次精算 CSV ダウンロード
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listPayouts, payoutsToCsv } from '@/lib/payouts/calculate';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get('period');
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'invalid_period' }, { status: 400 });
  }

  const rows = await listPayouts(`${period}-01`);
  const csv = payoutsToCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="kizashi-payouts-${period}.csv"`,
    },
  });
}
