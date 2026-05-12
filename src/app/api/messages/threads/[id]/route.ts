/**
 * GET /api/messages/threads/:id
 *
 * スレッド詳細とメッセージ一覧を取得 (参加権限検証)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getThreadWithMessages, markThreadAsRead } from '@/lib/messaging/threads';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const result = await getThreadWithMessages(params.id, me.role, me.userId);
  if ('error' in result) {
    const status = result.error === 'not_found' ? 404 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  // 既読更新（非同期で問題なし、await して return）
  await markThreadAsRead(params.id, me.role);
  return NextResponse.json(result);
}
