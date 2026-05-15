/**
 * ステップメール シーケンス一覧 + 新規作成
 */
import Link from 'next/link';
import { listSequences } from '@/lib/marketing/admin-queries';
import { createSequence } from '@/lib/marketing/admin-actions';
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

export default async function SequencesPage() {
  const sequences = await listSequences();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ステップメール シーケンス</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          目的: LP / ブログから取得したリードを段階的にナーチャリングし、
          <b>体験予約申込</b> につなげる。トリガーは購読 / タグ追加 / イベント / 手動から選択。
          各ステップに「無料体験を予約する」CTA URL (例:{' '}
          <code className="rounded bg-muted px-1">/login?redirect_to=/mypage/trial-reservation</code>) を仕込んでください。
        </p>
      </div>

      <form
        action={createSequence}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="name">シーケンス名</Label>
          <Input id="name" name="name" required maxLength={160} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">説明</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="trigger">トリガー</Label>
          <select
            id="trigger"
            name="trigger"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="subscription"
          >
            <option value="subscription">購読時</option>
            <option value="tag_added">タグ追加時</option>
            <option value="event">イベント</option>
            <option value="manual">手動</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="trigger_tag">トリガータグ (tag_added)</Label>
          <Input id="trigger_tag" name="trigger_tag" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from_name">送信者名</Label>
          <Input id="from_name" name="from_name" defaultValue="Kizashi" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from_email">送信元メール</Label>
          <Input id="from_email" name="from_email" type="email" required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="reply_to">返信先メール (任意)</Label>
          <Input id="reply_to" name="reply_to" type="email" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">シーケンス作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>トリガー</TableHead>
              <TableHead>送信元</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだシーケンスがありません
                </TableCell>
              </TableRow>
            )}
            {sequences.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{s.trigger}</Badge>
                  {s.trigger_tag && <span className="ml-2 text-xs">{s.trigger_tag}</span>}
                </TableCell>
                <TableCell className="text-xs">
                  {s.from_name} &lt;{s.from_email}&gt;
                </TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? 'default' : 'secondary'}>
                    {s.is_active ? '稼働中' : '停止'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/marketing/sequences/${s.id}`}>ステップ編集</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
