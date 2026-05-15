/**
 * A012 チケット新規登録
 */
import Link from 'next/link';
import { TicketForm } from '@/components/admin/ticket-form';
import { createTicketAction } from '@/lib/admin/ticket-actions';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  create_failed: '登録に失敗しました。',
};

export default function NewTicketPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tickets" className="text-sm text-muted-foreground underline">
            ← 一覧へ戻る
          </Link>
          <h1 className="mt-2 text-2xl font-bold">チケットを新規登録</h1>
        </div>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <TicketForm action={createTicketAction} submitLabel="登録" />
    </div>
  );
}
