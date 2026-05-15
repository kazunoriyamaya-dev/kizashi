/**
 * SNS 投稿 一覧 + 新規予約投稿
 */
import { listSnsPosts } from '@/lib/marketing/admin-queries';
import { createSnsPost } from '@/lib/marketing/admin-actions';
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

const CHANNELS = [
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
];

const STATUS_COLOR: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'secondary',
  scheduled: 'outline',
  queued: 'outline',
  published: 'default',
  failed: 'destructive',
  archived: 'secondary',
};

export default async function SnsPostsPage() {
  const posts = await listSnsPosts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SNS 投稿</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          各 SNS プラットフォーム宛の予約投稿。scheduled_at 到達時に cron 経由で publish されます。
        </p>
      </div>

      <form
        action={createSnsPost}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="channel">チャネル</Label>
          <select
            id="channel"
            name="channel"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="twitter"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
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
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body">本文</Label>
          <Textarea id="body" name="body" rows={4} required maxLength={4000} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="hashtags">ハッシュタグ (# 不要、カンマ区切り)</Label>
          <Input id="hashtags" name="hashtags" placeholder="kizashi, 体験レッスン, 小学生" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="scheduled_at">予約日時</Label>
          <Input id="scheduled_at" name="scheduled_at" type="datetime-local" />
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit">作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>チャネル</TableHead>
              <TableHead>本文</TableHead>
              <TableHead>予約</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>外部ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだ投稿がありません
                </TableCell>
              </TableRow>
            )}
            {posts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Badge variant="outline">
                    {CHANNELS.find((c) => c.value === p.channel)?.label ?? p.channel}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="line-clamp-2 text-sm">{p.body}</div>
                  {p.hashtags?.length ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.hashtags.map((h) => `#${h}`).join(' ')}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs">
                  {p.scheduled_at?.replace('T', ' ').slice(0, 16) ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLOR[p.status] ?? 'secondary'}>{p.status}</Badge>
                  {p.error_message && (
                    <div className="mt-1 text-xs text-destructive">{p.error_message}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{p.external_post_id ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
