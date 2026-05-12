/**
 * API002 GET /api/admin/reservations - 予約一覧
 *
 * Phase 3 では一覧取得のみ。詳細・更新は Phase 6/9 で本実装。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  const status = url.searchParams.get('status');

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('reservations')
    .select(
      `id, start_at, end_at, category, status, delivery_type, reservation_type,
       customer_id, instructor_id`,
      { count: 'exact' },
    )
    .order('start_at', { ascending: false });

  if (status) query = query.eq('status', status as 'confirmed' | 'cancelled' | 'completed');

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  return NextResponse.json({ reservations: data, total: count ?? 0 });
}
