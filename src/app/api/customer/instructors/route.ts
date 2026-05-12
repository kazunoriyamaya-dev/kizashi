/**
 * API014 GET /api/customer/instructors
 *
 * 公開講師一覧。instructors_public ビュー経由で公開列のみ返す (Q018)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Category, InstructorRank } from '@/types';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = request.nextUrl;
  const category = url.searchParams.get('category');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 200);

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('instructors_public')
    .select('id, nickname, avatar_url, public_bio, categories, genres, rank')
    .order('rank', { ascending: false })
    .order('nickname')
    .limit(limit);

  if (category && ['learning', 'sports', 'art'].includes(category)) {
    query = query.contains('categories', [category as Category]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });

  // 指名料を結合して返す
  const { data: settings } = await supabase
    .from('system_settings')
    .select('instructor_designation_fees')
    .maybeSingle();

  const fees =
    (settings?.instructor_designation_fees as Record<InstructorRank, number>) ??
    ({ gold: 1500, silver: 1000, bronze: 500, regular: 0 } as Record<InstructorRank, number>);

  const enriched = (data ?? []).map((i) => ({
    ...i,
    designation_fee: fees[i.rank as InstructorRank] ?? 0,
  }));

  return NextResponse.json({ instructors: enriched });
}
