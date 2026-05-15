/**
 * キャンペーン一覧 + 新規作成フォーム
 */
import { listCampaigns } from '@/lib/marketing/admin-queries';
import { createCampaign } from '@/lib/marketing/admin-actions';
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

const OBJECTIVES: Array<{ value: string; label: string }> = [
  { value: 'awareness', label: '認知' },
  { value: 'traffic', label: '集客' },
  { value: 'lead', label: 'リード獲得' },
  { value: 'conversion', label: 'コンバージョン' },
  { value: 'retention', label: 'リテンション' },
];

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">キャンペーン</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          各種マーケ施策 (SNS / LP / メール / 広告) をまとめる上位概念です
        </p>
      </div>

      <form
        action={createCampaign}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="name">名称</Label>
          <Input id="name" name="name" required maxLength={120} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slug">slug</Label>
          <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="objective">目的</Label>
          <select
            id="objective"
            name="objective"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="awareness"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="budget_jpy">予算 (円)</Label>
          <Input id="budget_jpy" name="budget_jpy" type="number" min={0} defaultValue={0} />
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
          <Label htmlFor="description">概要</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>slug</TableHead>
              <TableHead>目的</TableHead>
              <TableHead className="text-right">予算</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>期間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  まだキャンペーンがありません
                </TableCell>
              </TableRow>
            )}
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                <TableCell>
                  {OBJECTIVES.find((o) => o.value === c.objective)?.label ?? c.objective}
                </TableCell>
                <TableCell className="text-right">
                  ¥{(c.budget_jpy ?? 0).toLocaleString('ja-JP')}
                </TableCell>
                <TableCell>
                  <Badge variant={c.is_active ? 'default' : 'secondary'}>
                    {c.is_active ? '稼働中' : '停止'}
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
