/**
 * C009 顧客予約一覧
 *
 * 自身の予約をタブで「今後」「過去」に分けて表示
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CATEGORY_LABELS, type Category, type ReservationStatus } from '@/types';

const STATUS_LABEL: Partial<Record<ReservationStatus, string>> = {
  draft: '下書き',
  pending_payment: '決済待ち',
  confirmed: '確定',
  changed: '変更済',
  cancelled: 'キャンセル',
  completed: '受講済',
  no_show: '欠席',
};

interface ListRow {
  id: string;
  start_at: string;
  category: Category;
  status: ReservationStatus;
  delivery_type: 'online' | 'onsite';
  reservation_type: 'normal' | 'trial';
  instructors: { nickname: string } | null;
}

export default async function CustomerReservationListPage() {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) return null;

  const now = new Date().toISOString();
  const [upcoming, past] = await Promise.all([
    supabase
      .from('reservations')
      .select(
        `id, start_at, category, status, delivery_type, reservation_type,
         instructors!reservations_instructor_id_fkey ( nickname )`,
      )
      .eq('customer_id', customer.id)
      .gte('start_at', now)
      .order('start_at', { ascending: true })
      .limit(50),
    supabase
      .from('reservations')
      .select(
        `id, start_at, category, status, delivery_type, reservation_type,
         instructors!reservations_instructor_id_fkey ( nickname )`,
      )
      .eq('customer_id', customer.id)
      .lt('start_at', now)
      .order('start_at', { ascending: false })
      .limit(50),
  ]);

  const upcomingList = (upcoming.data ?? []) as ListRow[];
  const pastList = (past.data ?? []) as ListRow[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">予約一覧</h1>

      <Tabs defaultValue="upcoming">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">今後 ({upcomingList.length})</TabsTrigger>
          <TabsTrigger value="past">過去 ({pastList.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-3">
          {upcomingList.length === 0 ? (
            <p className="text-sm text-muted-foreground">予定された予約はありません</p>
          ) : (
            upcomingList.map((r) => <ReservationRow key={r.id} r={r} />)
          )}
        </TabsContent>
        <TabsContent value="past" className="space-y-3">
          {pastList.length === 0 ? (
            <p className="text-sm text-muted-foreground">過去の予約はありません</p>
          ) : (
            pastList.map((r) => <ReservationRow key={r.id} r={r} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReservationRow({ r }: { r: ListRow }) {
  return (
    <Link href={`/mypage/reservations/${r.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-2 p-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              {new Date(r.start_at).toLocaleString('ja-JP', {
                month: '2-digit',
                day: '2-digit',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <Badge
              variant={
                r.status === 'confirmed'
                  ? 'success'
                  : r.status === 'cancelled'
                    ? 'destructive'
                    : r.status === 'completed'
                      ? 'outline'
                      : 'secondary'
              }
            >
              {STATUS_LABEL[r.status] ?? r.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">{CATEGORY_LABELS[r.category]}</Badge>
            <Badge variant="outline">{r.delivery_type === 'onsite' ? '対面' : 'オンライン'}</Badge>
            {r.reservation_type === 'trial' && <Badge variant="warning">体験</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            講師: {r.instructors?.nickname ?? '未割当'}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
