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
import { fetchAcquisitionFunnel } from '@/lib/marketing/attribution';
import { formatJPY } from '@/lib/utils';

const SOURCE_LABEL: Record<string, string> = {
  lp: 'ランディングページ',
  blog: 'ブログ',
  affiliate: 'アフィリエイト',
  sns: 'SNS',
  ad: '広告',
  line: '公式LINE',
  direct: '直接 / メール',
  referral: '外部リンク',
  unknown: '不明',
};

export default async function AnalyticsPage() {
  const admin = createSupabaseAdminClient();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  const funnel = await fetchAcquisitionFunnel(30);

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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">分析 / 新規顧客獲得ファネル</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          目的: 生徒数の増加。LP / ブログ / SNS / 広告 / アフィリエイト経由のリードが
          体験予約 → 顧客化 → 有料化までどう進んだかを追跡します (直近 30 日)。
        </p>
      </div>

      {/* 新規顧客獲得ファネル */}
      <section>
        <h2 className="text-lg font-semibold">獲得ファネル (30 日)</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="① リード (購読)" value={funnel.leads} hint="LP/ブログのフォーム" />
          <KpiCard
            label="② アカウント作成"
            value={funnel.profilesLinked}
            hint={
              funnel.leads > 0
                ? `${((funnel.profilesLinked / funnel.leads) * 100).toFixed(1)}%`
                : '-'
            }
          />
          <KpiCard
            label="③ 体験予約"
            value={funnel.trialsReserved}
            hint={`Lead→Trial CVR: ${funnel.cvrLeadToTrial.toFixed(1)}%`}
            accent={funnel.cvrLeadToTrial >= 10 ? 'success' : 'default'}
          />
          <KpiCard label="④ 体験完了" value={funnel.trialsCompleted} />
          <KpiCard
            label="⑤ 初回有料化"
            value={funnel.firstPaid}
            hint={`Trial→Paid CVR: ${funnel.cvrTrialToPaid.toFixed(1)}% / 初回売上 ${formatJPY(funnel.firstPaidRevenueJpy)}`}
            accent={funnel.cvrTrialToPaid >= 30 ? 'success' : 'default'}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ※ profile_id への紐付けは購読時メールと一致するアカウント作成を検知して反映 (cron で同期)。
        </p>
      </section>

      {/* 流入源別 内訳 */}
      <section>
        <h2 className="text-lg font-semibold">流入源別 (30 日)</h2>
        <div className="mt-3 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>流入源</TableHead>
                <TableHead className="text-right">リード</TableHead>
                <TableHead className="text-right">体験予約</TableHead>
                <TableHead className="text-right">有料化</TableHead>
                <TableHead className="text-right">CVR (体験予約)</TableHead>
                <TableHead className="text-right">初回売上</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funnel.bySource.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    まだリードがありません
                  </TableCell>
                </TableRow>
              )}
              {funnel.bySource.map((s) => {
                const cvr = s.leads > 0 ? (s.trials / s.leads) * 100 : 0;
                return (
                  <TableRow key={s.source}>
                    <TableCell>{SOURCE_LABEL[s.source] ?? s.source}</TableCell>
                    <TableCell className="text-right">{s.leads}</TableCell>
                    <TableCell className="text-right">{s.trials}</TableCell>
                    <TableCell className="text-right">{s.paid}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{cvr.toFixed(1)}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatJPY(s.revenueJpy)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <div>
        <h2 className="text-lg font-semibold">エンゲージメント指標 (30 日)</h2>
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
