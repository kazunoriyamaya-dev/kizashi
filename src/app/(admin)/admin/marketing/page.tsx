/**
 * マーケ ダッシュボード
 */
import {
  Sparkles,
  MailPlus,
  Users,
  ListChecks,
  PenSquare,
  MessageCircle,
  Megaphone,
  MousePointerClick,
  Target,
  UserPlus,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { KpiCard } from '@/components/admin/kpi-card';
import { fetchMarketingDashboardKpi, fetchAdMetricsSummary } from '@/lib/marketing/admin-queries';
import { fetchAcquisitionFunnel } from '@/lib/marketing/attribution';
import { formatJPY } from '@/lib/utils';

export default async function MarketingDashboardPage() {
  const [kpi, adSummary, funnel] = await Promise.all([
    fetchMarketingDashboardKpi(),
    fetchAdMetricsSummary(30),
    fetchAcquisitionFunnel(30),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          目的: 生徒数の増加。新規顧客獲得ファネルと施策運用状況のサマリーです (直近 30 日)。
        </p>
      </div>

      {/* 最重要 KPI: 新規顧客獲得 */}
      <section>
        <h2 className="text-lg font-semibold">新規顧客獲得ファネル (30 日)</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="リード獲得"
            value={funnel.leads}
            hint="LP / ブログのフォーム購読"
            Icon={Target}
          />
          <KpiCard
            label="体験予約申込"
            value={funnel.trialsReserved}
            hint={`Lead→Trial CVR ${funnel.cvrLeadToTrial.toFixed(1)}%`}
            Icon={UserPlus}
            accent={funnel.cvrLeadToTrial >= 10 ? 'success' : 'default'}
          />
          <KpiCard
            label="体験完了"
            value={funnel.trialsCompleted}
            hint="トライアル消化"
            Icon={CheckCircle2}
          />
          <KpiCard
            label="初回有料化"
            value={funnel.firstPaid}
            hint={`売上 ${formatJPY(funnel.firstPaidRevenueJpy)}`}
            Icon={CreditCard}
            accent={funnel.firstPaid > 0 ? 'success' : 'default'}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ※ 詳細は{' '}
          <a href="/admin/marketing/analytics" className="text-primary hover:underline">
            /admin/marketing/analytics
          </a>{' '}
          を参照。流入源別の体験予約 CVR / 初回売上が確認できます。
        </p>
      </section>

      <h2 className="text-lg font-semibold">施策運用状況</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="キャンペーン総数" value={kpi.campaigns} Icon={Sparkles} />
        <KpiCard label="稼働中シーケンス" value={kpi.activeSequences} Icon={MailPlus} />
        <KpiCard
          label="購読者 (active)"
          value={kpi.activeSubscribers}
          hint={`+${kpi.thirtyDaySubscribers} 件 (30日)`}
          Icon={Users}
        />
        <KpiCard label="公開中LP" value={kpi.publishedLandingPages} Icon={ListChecks} />
        <KpiCard label="公開中ブログ" value={kpi.publishedBlogPosts} Icon={PenSquare} />
        <KpiCard
          label="予約 SNS 投稿"
          value={kpi.scheduledSnsPosts}
          hint="未配信"
          Icon={MessageCircle}
        />
        <KpiCard
          label="予約 LINE 配信"
          value={kpi.scheduledLineBroadcasts}
          hint="未配信"
          Icon={MessageCircle}
        />
        <KpiCard
          label="広告クリック (30日)"
          value={kpi.thirtyDayClicks}
          hint="アフィリエイト含む"
          Icon={MousePointerClick}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold">広告サマリー (30日)</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="広告キャンペーン (active)"
            value={kpi.activeAdCampaigns}
            Icon={Megaphone}
          />
          <KpiCard label="表示回数" value={adSummary.impressions.toLocaleString('ja-JP')} />
          <KpiCard label="クリック" value={adSummary.clicks.toLocaleString('ja-JP')} />
          <KpiCard label="広告費" value={formatJPY(adSummary.spend_jpy)} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ※ 数値は marketing_ad_metrics_daily に保存された日次データの累計です。広告 API
          連携が未設定の場合は 0 のままになります。
        </p>
      </section>
    </div>
  );
}
