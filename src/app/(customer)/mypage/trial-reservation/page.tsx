/**
 * C008 体験予約画面
 *
 * - 講師選択不可（システム自動割当 Q004）
 * - 体験未利用の子供のみ選択可
 * - ジャンル + 形式 + 時間範囲を選択
 */
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { createTrialReservationAction } from '@/lib/customer/trial-actions';
import { CATEGORY_LABELS } from '@/types';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  child_not_found: 'お子様が見つかりません。',
  trial_already_used: 'このお子様は既に体験を利用済みです。',
  no_available_instructor:
    '希望条件に合う講師が見つかりませんでした。日時を広げて再度お試しください。',
  time_conflict: '直前に他の方が予約された可能性があります。再度お試しください。',
  unknown: '体験予約に失敗しました。再度お試しください。',
};

function nextDays(count: number) {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export default async function TrialReservationPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const me = await getCurrentUser();
  if (!me) return null;

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select(
      `id,
       children ( id, name, kana, birth_date, trial_used )`,
    )
    .eq('profile_id', me.userId)
    .maybeSingle();
  if (!customer) return null;

  const unusedChildren = (customer.children ?? []).filter((c) => !c.trial_used);
  const dateOptions = nextDays(14);
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mypage" className="text-sm text-muted-foreground underline">
          ← マイページへ戻る
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-600" />
          <h1 className="text-2xl font-bold">体験予約</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          お子様 1 人につき 1 回まで、無料で体験レッスンを受けられます (Q002)
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {unusedChildren.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm">
            {customer.children?.length === 0 ? (
              <>
                <p className="text-muted-foreground">先にお子様情報を登録してください</p>
                <Button asChild className="mt-4">
                  <Link href="/mypage/profile/edit">お子様を登録</Link>
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                すべてのお子様が既に体験を利用済みです（通常予約をご利用ください）
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <form action={createTrialReservationAction} className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <label className="text-sm font-semibold">1. 受講するお子様</label>
              <div className="space-y-2">
                {unusedChildren.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 rounded-md border p-3">
                    <input
                      type="radio"
                      name="child_id"
                      value={c.id}
                      required
                      defaultChecked={c.id === unusedChildren[0]?.id}
                    />
                    <div className="text-sm">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.kana} ・ {new Date(c.birth_date).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Q003:
                同じ氏名・フリガナ・生年月日のお子様が既に体験を利用済みの場合、管理者の確認が必要となります。
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <label className="text-sm font-semibold">2. ジャンル</label>
              <div className="grid grid-cols-3 gap-2">
                {(['learning', 'sports', 'art'] as const).map((c) => (
                  <label
                    key={c}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="category"
                      value={c}
                      required
                      defaultChecked={c === 'learning'}
                    />
                    {CATEGORY_LABELS[c]}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <label className="text-sm font-semibold">3. レッスン時間と形式</label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex items-center gap-2 rounded-md border p-3">
                  <input type="radio" name="duration_min" value="60" required defaultChecked />
                  60 分
                </label>
                <label className="flex items-center gap-2 rounded-md border p-3">
                  <input type="radio" name="duration_min" value="90" required />
                  90 分
                </label>
                <label className="flex items-center gap-2 rounded-md border p-3">
                  <input type="radio" name="delivery_type" value="online" required defaultChecked />
                  オンライン
                </label>
                <label className="flex items-center gap-2 rounded-md border p-3">
                  <input type="radio" name="delivery_type" value="onsite" required />
                  対面
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                オンラインは Google Meet URL が自動発行されます (Q006)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <label className="text-sm font-semibold">4. 希望日時範囲</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="from_date" className="text-xs text-muted-foreground">
                    開始日
                  </label>
                  <select
                    id="from_date"
                    name="from_date"
                    required
                    defaultValue={dateOptions[0]}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {dateOptions.map((d) => (
                      <option key={d} value={d}>
                        {new Date(d).toLocaleDateString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          weekday: 'short',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="to_date" className="text-xs text-muted-foreground">
                    終了日
                  </label>
                  <select
                    id="to_date"
                    name="to_date"
                    required
                    defaultValue={dateOptions[6]}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {dateOptions.map((d) => (
                      <option key={d} value={d}>
                        {new Date(d).toLocaleDateString('ja-JP', {
                          month: '2-digit',
                          day: '2-digit',
                          weekday: 'short',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                指定した期間内で講師を自動的に割り当てます (Q004)
              </p>
            </CardContent>
          </Card>

          {/* hidden: from_iso/to_iso/preferred_starts を Server Action 側で合成するため、 */}
          {/* form は from_date/to_date のみ送信。Server Action で ISO に変換する */}
          <TrialIsoBridge />

          <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <Button type="submit" size="lg" className="w-full">
              体験予約を確定する
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              ※ 体験予約はチケット消化なしで無料です（指名料は発生する場合があります）
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Form 内に from_iso / to_iso / preferred_starts の hidden を埋めるための小さなクライアント部品。
 * Server Action 側で from_date / to_date から日付範囲を解釈する代わりに、
 * クライアントで現在時刻のタイムゾーンで ISO に変換して埋め込む。
 */
function TrialIsoBridge() {
  return (
    <script
      // 軽量な inline script。フォーム送信前に from_date/to_date を ISO に変換し hidden に注入
      dangerouslySetInnerHTML={{
        __html: `
document.addEventListener('submit', function(ev){
  var f = ev.target;
  if (!f || !f.querySelector('[name="from_date"]')) return;
  var from = f.querySelector('[name="from_date"]').value;
  var to = f.querySelector('[name="to_date"]').value;
  if (!from || !to) return;
  // 9:00 - 23:00 を ISO に
  var fromIso = new Date(from + 'T09:00:00').toISOString();
  var toIso = new Date(to + 'T23:00:00').toISOString();
  function setHidden(name, value){
    var existing = f.querySelector('[name="' + name + '"]');
    if (existing) { existing.value = value; return; }
    var i = document.createElement('input');
    i.type = 'hidden'; i.name = name; i.value = value;
    f.appendChild(i);
  }
  setHidden('from_iso', fromIso);
  setHidden('to_iso', toIso);
  setHidden('preferred_starts', '');
}, true);
        `,
      }}
    />
  );
}
