/**
 * マーケ 分析: イベント / アフィリエイト クリック / シーケンス配信実績
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { KpiCard } from '@/components/admin/kpi-card';

export default async function AnalyticsPage() {
  const admin = createSupabaseAdminClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  const [
    eventCount30,
    eventCount7,
    affiliateClick30,
    affiliateConversion30,
    emailSent30,
    emailFailed30,
    topEventsRes,
    topPagesRes,
  ] = await Promise.all([
    admin
      .from('marketing_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30),
    admin
      .from('marketing_analytics_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since7),
    admin
      .from('marketing_affiliate_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', since30),
    admin
      .from('marketing_affiliate_conversions')
      .select('*', { count: 'exact', head: true })
      .gte('converted_at', since30),
    admin
      .from('marketing_email_sends')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30)
      .eq('status', 'sent'),
    admin
      .from('marketing_email_sends')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since30)
      .eq('status', 'failed'),
    admin
      .from('marketing_analytics_events')
      .select('event_name')
      .gte('created_at', since30)
      .limit(1000),
    admin
      .from('marketing_landing_pages')
      .select('id, title, slug, view_count, conversion_count')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(10),
  ]);

  const eventCounts = new Map<string, number>();
  for (const e of topEventsRes.data ?? []) {
    eventCounts.set(e.event_name, (eventCounts.get(e.event_name) ?? 0) + 1);
  }
  const topEvents = Array.from(eventCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">分析</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          各種マーケ施策のサマリー (デフォルト 30 日窓)
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="総イベント (30日)" value={eventCount30.count ?? 0} hint={`7日: ${eventCount7.count ?? 0}`} />
        <KpiCard label="アフィリエイト クリック" value={affiliateClick30.count ?? 0} hint="30日" />
        <KpiCard label="アフィリエイト コンバージョン" value={affiliateConversion30.count ?? 0} hint="30日" />
        <KpiCard
          label="メール送信"
          value={emailSent30.count ?? 0}
          hint={`失敗: ${emailFailed30.count ?? 0}`}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">人気イベント (30日)</h2>
        <div className="mt-3 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>イベント名</TableHead>
                <TableHead className="text-right">件数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    まだイベントデータがありません
                  </TableCell>
                </TableRow>
              )}
              {topEvents.map(([name, count]) => (
                <TableRow key={name}>
                  <TableCell className="font-mono text-xs">{name}</TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">公開中 LP PV ランキング</h2>
        <div className="mt-3 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LP</TableHead>
                <TableHead>slug</TableHead>
                <TableHead className="text-right">PV</TableHead>
                <TableHead className="text-right">CV</TableHead>
                <TableHead className="text-right">CVR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(topPagesRes.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    公開中 LP がありません
                  </TableCell>
                </TableRow>
              )}
              {(topPagesRes.data ?? []).map((p) => {
                const cvr = p.view_count > 0 ? (p.conversion_count / p.view_count) * 100 : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                    <TableCell className="text-right">{p.view_count}</TableCell>
                    <TableCell className="text-right">{p.conversion_count}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{cvr.toFixed(2)}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
