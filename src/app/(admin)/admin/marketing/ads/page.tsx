/**
 * 広告キャンペーン管理 + 日次サマリー
 */
import { listAdCampaigns, fetchAdMetricsSummary } from '@/lib/marketing/admin-queries';
import { createAdCampaign } from '@/lib/marketing/admin-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { formatJPY } from '@/lib/utils';

const PLATFORMS = [
  { value: 'meta', label: 'Meta (FB/IG)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'yahoo', label: 'Yahoo!' },
  { value: 'line_ads', label: 'LINE Ads' },
  { value: 'other', label: 'その他' },
];

export default async function AdCampaignsPage() {
  const [campaigns, summary] = await Promise.all([listAdCampaigns(), fetchAdMetricsSummary(30)]);

  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const cpc = summary.clicks > 0 ? summary.spend_jpy / summary.clicks : 0;
  const cpa = summary.conversions > 0 ? summary.spend_jpy / summary.conversions : 0;
  const roas = summary.spend_jpy > 0 ? (summary.revenue_jpy / summary.spend_jpy) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">広告運用</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          各広告プラットフォームのキャンペーンを管理し、cron で日次メトリクスを取得します。
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="CTR (30日)" value={`${ctr.toFixed(2)}%`} />
        <KpiCard label="CPC (30日)" value={formatJPY(Math.round(cpc))} />
        <KpiCard
          label="CPA (30日)"
          value={summary.conversions > 0 ? formatJPY(Math.round(cpa)) : '-'}
        />
        <KpiCard label="ROAS (30日)" value={`${roas.toFixed(1)}%`} />
      </section>

      <form
        action={createAdCampaign}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="name">キャンペーン名</Label>
          <Input id="name" name="name" required maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="platform">プラットフォーム</Label>
          <select
            id="platform"
            name="platform"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="meta"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="external_id">外部キャンペーンID</Label>
          <Input id="external_id" name="external_id" placeholder="ad platform 側 ID" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">状態</Label>
          <select
            id="status"
            name="status"
            defaultValue="draft"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">下書き</option>
            <option value="active">配信中</option>
            <option value="paused">一時停止</option>
            <option value="completed">終了</option>
            <option value="archived">アーカイブ</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="daily_budget_jpy">日予算 (円)</Label>
          <Input
            id="daily_budget_jpy"
            name="daily_budget_jpy"
            type="number"
            min={0}
            defaultValue={0}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="total_budget_jpy">総予算 (円)</Label>
          <Input
            id="total_budget_jpy"
            name="total_budget_jpy"
            type="number"
            min={0}
            defaultValue={0}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="start_at">開始</Label>
          <Input id="start_at" name="start_at" type="datetime-local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="end_at">終了</Label>
          <Input id="end_at" name="end_at" type="datetime-local" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="notes">メモ</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">広告キャンペーン作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>プラットフォーム</TableHead>
              <TableHead>外部ID</TableHead>
              <TableHead className="text-right">日予算</TableHead>
              <TableHead className="text-right">総予算</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>期間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  まだ広告キャンペーンがありません
                </TableCell>
              </TableRow>
            )}
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {PLATFORMS.find((p) => p.value === c.platform)?.label ?? c.platform}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{c.external_id ?? '-'}</TableCell>
                <TableCell className="text-right">
                  ¥{c.daily_budget_jpy.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell className="text-right">
                  ¥{c.total_budget_jpy.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell>
                  <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.start_at?.slice(0, 10) ?? '-'} → {c.end_at?.slice(0, 10) ?? '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
