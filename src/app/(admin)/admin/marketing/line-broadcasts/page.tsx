/**
 * LINE 公式ブロードキャスト 一覧 + 新規作成
 */
import { listLineBroadcasts } from '@/lib/marketing/admin-queries';
import { createLineBroadcast } from '@/lib/marketing/admin-actions';
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

export default async function LineBroadcastsPage() {
  const broadcasts = await listLineBroadcasts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">LINE 公式ブロードキャスト</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          target_type=all は全友だち配信、segment / tag は narrowcast を使用します。 scheduled_at
          到達時に cron で配信。
        </p>
      </div>

      <form
        action={createLineBroadcast}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="title">タイトル (内部管理用)</Label>
          <Input id="title" name="title" required maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="target_type">配信対象</Label>
          <select
            id="target_type"
            name="target_type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="all"
          >
            <option value="all">全友だち</option>
            <option value="segment">セグメント (audienceGroupId)</option>
            <option value="tag">タグ</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="target_tag">タグ (target_type=tag のとき)</Label>
          <Input id="target_tag" name="target_tag" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="scheduled_at">予約日時</Label>
          <Input id="scheduled_at" name="scheduled_at" type="datetime-local" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body">本文 (text メッセージ)</Label>
          <Textarea id="body" name="body" rows={4} required maxLength={5000} />
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
            <option value="scheduled">予約配信</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit">作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイトル</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>予約</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">配信</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだブロードキャストがありません
                </TableCell>
              </TableRow>
            )}
            {broadcasts.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{b.target_type}</Badge>
                  {b.target_tag && <span className="ml-2 text-xs">{b.target_tag}</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {b.scheduled_at?.replace('T', ' ').slice(0, 16) ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={b.status === 'published' ? 'default' : 'secondary'}>
                    {b.status}
                  </Badge>
                  {b.error_message && (
                    <div className="mt-1 text-xs text-destructive">{b.error_message}</div>
                  )}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  送信 {b.sent_count} / 配信 {b.delivered_count} / 失敗 {b.failed_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
