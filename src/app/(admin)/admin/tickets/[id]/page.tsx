/**
 * A013 チケット詳細・編集
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { TicketForm } from '@/components/admin/ticket-form';
import { updateTicketAction, deleteTicketAction } from '@/lib/admin/ticket-actions';
import type { Category, LessonFormat } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  update_failed: '更新に失敗しました。',
  delete_failed: '削除に失敗しました。',
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { updated?: string; created?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: ticket } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!ticket) notFound();

  const flash = searchParams.created
    ? 'チケットを登録しました'
    : searchParams.updated
      ? '更新しました'
      : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tickets" className="text-sm text-muted-foreground underline">
            ← 一覧へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{ticket.name}</h1>
          <p className="text-sm text-muted-foreground">ID: {ticket.id}</p>
        </div>
        <form action={deleteTicketAction.bind(null, ticket.id)}>
          <Button type="submit" variant="destructive">
            削除（論理）
          </Button>
        </form>
      </div>

      {flash && (
        <p className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {flash}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <TicketForm
        action={updateTicketAction.bind(null, ticket.id)}
        defaultValues={{
          name: ticket.name,
          description: ticket.description ?? '',
          category: ticket.category as Category | null,
          price: ticket.price,
          session_count: ticket.session_count,
          valid_days: ticket.valid_days,
          duration_min: ticket.duration_min,
          lesson_format: ticket.lesson_format as LessonFormat,
          sort_order: ticket.sort_order,
          status: ticket.status as 'active' | 'inactive',
        }}
        submitLabel="保存"
        cancelHref="/admin/tickets"
      />
    </div>
  );
}
