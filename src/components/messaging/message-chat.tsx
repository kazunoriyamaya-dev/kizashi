'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { sendMessageAction } from '@/lib/messaging/actions';
import type { MessageRow } from '@/lib/messaging/threads';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  threadId: string;
  currentProfileId: string;
  currentRole: Role;
  messages: MessageRow[];
  /** admin による監査閲覧モード（投稿は可能だが視覚的に分離） */
  auditMode?: boolean;
}

const SENDER_LABEL: Record<Role, string> = {
  admin: '管理者',
  instructor: '講師',
  customer: '保護者',
};

export function MessageChat({
  threadId,
  currentProfileId,
  currentRole,
  messages,
  auditMode = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!body.trim()) return;
    const fd = new FormData();
    fd.set('body', body.trim());
    startTransition(async () => {
      await sendMessageAction(threadId, fd);
      setBody('');
    });
  };

  return (
    <div className="space-y-3">
      {auditMode && (
        <p className="rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900">
          管理者監査モード: このスレッドは利用規約に基づき閲覧可能です (Q015)
        </p>
      )}

      <div className="space-y-3 rounded-md border bg-muted/30 p-3">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            まだメッセージがありません
          </p>
        ) : (
          messages.map((m) => {
            const isMine = m.senderProfileId === currentProfileId;
            const role = m.senderRole ?? 'customer';
            return (
              <div
                key={m.id}
                className={cn(
                  'flex flex-col',
                  isMine ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm',
                    isMine
                      ? 'bg-primary text-primary-foreground'
                      : role === 'admin'
                        ? 'border border-yellow-300 bg-yellow-50 text-yellow-900'
                        : 'bg-background',
                  )}
                >
                  <div
                    className={cn(
                      'mb-0.5 text-[10px]',
                      isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {SENDER_LABEL[role]}
                    {m.senderName ? ` ・ ${m.senderName}` : ''}
                    {' ・ '}
                    {new Date(m.createdAt).toLocaleString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            currentRole === 'admin'
              ? 'メッセージを入力 (管理者として送信)'
              : 'メッセージを入力'
          }
          rows={2}
          maxLength={5000}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || !body.trim()}>
          送信
        </Button>
      </form>
    </div>
  );
}
