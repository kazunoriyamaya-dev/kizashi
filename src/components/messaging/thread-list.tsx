import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ThreadSummary } from '@/lib/messaging/threads';

interface Props {
  threads: ThreadSummary[];
  basePath: '/admin/messages' | '/instructor/messages' | '/mypage/messages';
}

const TYPE_LABEL = {
  admin_customer: '管理者 ⇔ 顧客',
  instructor_customer: '講師 ⇔ 顧客',
  admin_instructor: '管理者 ⇔ 講師',
} as const;

export function ThreadList({ threads, basePath }: Props) {
  if (threads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          メッセージはまだありません
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {threads.map((t) => {
        const counterpartName =
          t.threadType === 'instructor_customer'
            ? `${t.instructorNickname ?? '–'}先生 ⇔ ${t.customerName ?? '–'}`
            : t.threadType === 'admin_customer'
              ? `${t.customerName ?? '–'} (顧客)`
              : `${t.instructorNickname ?? '–'} (講師)`;

        return (
          <Link key={t.id} href={`${basePath}/${t.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="space-y-1 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{counterpartName}</span>
                  <div className="flex items-center gap-2">
                    {t.unreadCount > 0 && (
                      <Badge variant="default" className="text-xs">
                        {t.unreadCount}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABEL[t.threadType]}
                    </Badge>
                  </div>
                </div>
                {t.lastMessageBody && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{t.lastMessageBody}</p>
                )}
                {t.lastMessageAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.lastMessageAt).toLocaleString('ja-JP')}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
