/**
 * シーケンス詳細: ステップ追加 / 一覧
 */
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSequenceStep } from '@/lib/marketing/admin-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export default async function SequenceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: sequence } = await supabase
    .from('marketing_email_sequences')
    .select(
      'id, name, description, trigger, trigger_tag, from_name, from_email, reply_to, is_active',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!sequence) notFound();

  const { data: steps } = await supabase
    .from('marketing_email_sequence_steps')
    .select('id, step_order, delay_minutes, subject, body_text, is_active')
    .eq('sequence_id', params.id)
    .order('step_order', { ascending: true });

  const nextOrder =
    (steps?.length ?? 0) > 0 ? Math.max(...(steps ?? []).map((s) => s.step_order)) + 1 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{sequence.name}</h1>
        {sequence.description && (
          <p className="mt-1 text-sm text-muted-foreground">{sequence.description}</p>
        )}
        <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
          <span>トリガー: {sequence.trigger}</span>
          <span>
            送信元: {sequence.from_name} &lt;{sequence.from_email}&gt;
          </span>
        </div>
      </div>

      <form
        action={createSequenceStep}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="sequence_id" value={sequence.id} />
        <div className="space-y-1">
          <Label htmlFor="step_order">step_order</Label>
          <Input
            id="step_order"
            name="step_order"
            type="number"
            min={0}
            defaultValue={nextOrder}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="delay_minutes">前のステップからの遅延 (分)</Label>
          <Input
            id="delay_minutes"
            name="delay_minutes"
            type="number"
            min={0}
            defaultValue={1440}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="subject">件名</Label>
          <Input id="subject" name="subject" required maxLength={200} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body_text">本文 (text)</Label>
          <Textarea
            id="body_text"
            name="body_text"
            rows={8}
            required
            placeholder={'{{ name }} 様\n\n…'}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="cta_url">CTA URL (任意)</Label>
          <Input id="cta_url" name="cta_url" type="url" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">ステップ追加</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead className="w-32">遅延</TableHead>
              <TableHead>件名 / 本文プレビュー</TableHead>
              <TableHead className="w-20">状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(steps ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  まだステップがありません
                </TableCell>
              </TableRow>
            )}
            {(steps ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono">{s.step_order}</TableCell>
                <TableCell className="text-xs">{s.delay_minutes} 分後</TableCell>
                <TableCell>
                  <div className="font-medium">{s.subject}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{s.body_text}</div>
                </TableCell>
                <TableCell className="text-xs">{s.is_active ? 'active' : 'inactive'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
