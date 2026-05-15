/**
 * マーケ 分析: イベント / アフィリエイト クリック / シーケンス配信実績
 */
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
import { fetchAnalyticsEngagementSummary } from '@/lib/marketing/admin-queries';
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
  const [funnel, engagement] = await Promise.all([
    fetchAcquisitionFunnel(30),
    fetchAnalyticsEngagementSummary(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">分析 / 新規顧客獲得ファネル</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          目的: 生徒数の増加。LP / ブログ / SNS / 広告 / アフィリエイト経由のリードが 体験予約 →
          顧客化 → 有料化までどう進んだかを追跡します (直近 30 日)。
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
          ※ profile_id への紐付けは購読時メールと一致するアカウント作成を検知して反映 (cron
          で同期)。
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
        <KpiCard
          label="総イベント (30日)"
          value={engagement.eventCount30}
          hint={`7日: ${engagement.eventCount7}`}
        />
        <KpiCard label="アフィリエイト クリック" value={engagement.affiliateClick30} hint="30日" />
        <KpiCard
          label="アフィリエイト コンバージョン"
          value={engagement.affiliateConversion30}
          hint="30日"
        />
        <KpiCard
          label="メール送信"
          value={engagement.emailSent30}
          hint={`失敗: ${engagement.emailFailed30}`}
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
              {engagement.topEvents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                    まだイベントデータがありません
                  </TableCell>
                </TableRow>
              )}
              {engagement.topEvents.map((e) => (
                <TableRow key={e.name}>
                  <TableCell className="font-mono text-xs">{e.name}</TableCell>
                  <TableCell className="text-right">{e.count}</TableCell>
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
              {engagement.topPages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    公開中 LP がありません
                  </TableCell>
                </TableRow>
              )}
              {engagement.topPages.map((p) => {
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
