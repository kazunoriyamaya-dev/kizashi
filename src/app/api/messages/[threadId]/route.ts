/**
 * API024 POST /api/messages/:threadId
 *
 * 指定スレッドにメッセージを送信。
 * 参加権限は getThreadWithMessages 経由で再確認。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getThreadWithMessages, sendMessage } from '@/lib/messaging/threads';

const BodySchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest, { params }: { params: { threadId: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const json = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  // 参加権限確認
  const verify = await getThreadWithMessages(params.threadId, me.role, me.userId);
  if ('error' in verify) {
    const status = verify.error === 'not_found' ? 404 : 403;
    return NextResponse.json({ error: verify.error }, { status });
  }

  const result = await sendMessage(params.threadId, me.userId, parsed.data.body);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
