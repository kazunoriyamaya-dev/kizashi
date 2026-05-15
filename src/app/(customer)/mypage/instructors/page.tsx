/**
 * C003 講師一覧（顧客向け）
 *
 * - instructors_public ビューを使用 (Q018: 公開列のみ)
 * - カテゴリでクライアント側絞込（クエリパラメータ）
 * - ランク別指名料は system_settings から読み出して表示
 */
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { InstructorCard } from '@/components/customer/instructor-card';
import { Badge } from '@/components/ui/badge';
import {
  CATEGORY_LABELS,
  INSTRUCTOR_DESIGNATION_FEES,
  type Category,
  type InstructorRank,
} from '@/types';
import { cn } from '@/lib/utils';

const CATEGORY_FILTERS: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'learning', label: CATEGORY_LABELS.learning },
  { value: 'sports', label: CATEGORY_LABELS.sports },
  { value: 'art', label: CATEGORY_LABELS.art },
];

export default async function InstructorListPage({
  searchParams,
}: {
  searchParams: { category?: string; q?: string };
}) {
  const supabase = createSupabaseServerClient();
  const filterCategory = searchParams.category as Category | 'all' | undefined;
  const query = searchParams.q?.trim() ?? '';

  // 公開ビューから取得
  let req = supabase
    .from('instructors_public')
    .select('id, nickname, avatar_url, public_bio, categories, genres, rank')
    .order('rank', { ascending: false }) // gold > silver > bronze > regular
    .order('nickname');

  if (filterCategory && filterCategory !== 'all') {
    req = req.contains('categories', [filterCategory]);
  }

  const { data: instructors } = await req;

  // クライアント側で nickname / bio の部分一致絞込（軽量）
  const filtered = (instructors ?? []).filter((i) => {
    if (!query) return true;
    const lq = query.toLowerCase();
    return (
      i.nickname.toLowerCase().includes(lq) ||
      (i.public_bio?.toLowerCase().includes(lq) ?? false) ||
      (i.genres ?? []).some((g) => g.toLowerCase().includes(lq))
    );
  });

  // システム設定から指名料を取得
  const { data: settings } = await supabase
    .from('system_settings')
    .select('instructor_designation_fees')
    .maybeSingle();

  const fees = ((settings?.instructor_designation_fees as Record<string, number>) ??
    INSTRUCTOR_DESIGNATION_FEES) as Record<InstructorRank, number>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">講師を探す</h1>
        <p className="mt-1 text-sm text-muted-foreground">学習・スポーツ・芸術の講師から選べます</p>
      </div>

      <form>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="ニックネーム / ジャンルで検索"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {filterCategory && filterCategory !== 'all' && (
          <input type="hidden" name="category" value={filterCategory} />
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((c) => {
          const active = (filterCategory ?? 'all') === c.value;
          return (
            <Link
              key={c.value}
              href={
                c.value === 'all'
                  ? `/mypage/instructors${query ? `?q=${encodeURIComponent(query)}` : ''}`
                  : `/mypage/instructors?category=${c.value}${query ? `&q=${encodeURIComponent(query)}` : ''}`
              }
            >
              <Badge
                variant={active ? 'default' : 'outline'}
                className={cn('cursor-pointer', active && 'pointer-events-none')}
              >
                {c.label}
              </Badge>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          条件に一致する講師が見つかりませんでした
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((i) => (
            <InstructorCard
              key={i.id}
              instructor={{
                id: i.id,
                nickname: i.nickname,
                avatar_url: i.avatar_url,
                public_bio: i.public_bio,
                categories: i.categories as Category[] | null,
                genres: i.genres as string[] | null,
                rank: i.rank as InstructorRank,
              }}
              designationFee={fees[i.rank as InstructorRank] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
