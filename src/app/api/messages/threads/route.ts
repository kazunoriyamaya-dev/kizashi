/**
 * API023 GET /api/messages/threads
 *
 * ロールに応じて参加 / 監査可能なスレッド一覧を返す
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listThreadsForUser } from '@/lib/messaging/threads';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const threads = await listThreadsForUser(me.role, me.userId);
  return NextResponse.json({ threads });
}
