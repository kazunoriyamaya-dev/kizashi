/**
 * 管理者: 体験予約 重複確認待ち一覧 (Q003)
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  approveTrialReviewAction,
  rejectTrialReviewAction,
} from '@/lib/admin/trial-review-actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: '対象のレビューは既に処理済みです。',
  customer_missing: '顧客情報が見つかりません。',
  payload_invalid: '保存されたリクエストが破損しています。',
  reject_failed: '却下に失敗しました。',
  child_not_found: 'お子様情報が見つかりません。',
  trial_already_used: 'お子様は既に体験を利用済みです。',
  no_available_instructor: '希望期間に空き枠を持つ講師が見つかりません。',
  time_conflict: '時間競合が発生しました。',
  unknown: '予約処理に失敗しました。',
};

export default async function TrialReviewsPage({
  searchParams,
}: {
  searchParams: { approved?: string; rejected?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: reviews } = await supabase
    .from('trial_pending_reviews')
    .select(
      `id, status, requested_at, requested_payload, child_id, matched_child_id, customer_id, review_note,
       customers!trial_pending_reviews_customer_id_fkey ( parent_name ),
       children!trial_pending_reviews_child_id_fkey ( name, kana, birth_date )`,
    )
    .order('requested_at', { ascending: false });

  const flash =
    searchParams.approved
      ? '体験予約を承認しました'
      : searchParams.rejected
        ? '体験予約を却下しました'
        : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  const pending = (reviews ?? []).filter((r) => r.status === 'pending');
  const others = (reviews ?? []).filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">体験予約 重複確認 (Q003)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          同じ氏名・フリガナ・生年月日のお子様が既に体験を利用済みのため確認が必要なリクエストです
        </p>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">確認待ち ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">確認待ちのリクエストはありません</p>
        ) : (
          pending.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 pt-6 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.children?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.children?.kana} ・ 生年月日{' '}
                      {r.children?.birth_date &&
                        new Date(r.children.birth_date).toLocaleDateString('ja-JP')}
                    </div>
                  </div>
                  <Badge variant="warning">確認待ち</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  申請者: {r.customers?.parent_name}
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold">申請内容</p>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
{JSON.stringify(r.requested_payload, null, 2)}
                  </pre>
                </div>

                <form action={approveTrialReviewAction.bind(null, r.id)} className="space-y-2">
                  <Input name="note" placeholder="管理者メモ（任意）" />
                  <div className="flex gap-2">
                    <Button type="submit" variant="default">
                      承認して予約成立
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      formAction={rejectTrialReviewAction.bind(null, r.id)}
                    >
                      却下
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">処理済み ({others.length})</h2>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">処理済みのリクエストはありません</p>
        ) : (
          others.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-1 pt-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {r.children?.name}（{r.customers?.parent_name}）
                  </span>
                  <Badge variant={r.status === 'approved' ? 'success' : 'destructive'}>
                    {r.status === 'approved' ? '承認' : '却下'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.requested_at).toLocaleString('ja-JP')}
                </p>
                {r.review_note && (
                  <p className="text-xs text-muted-foreground">メモ: {r.review_note}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
