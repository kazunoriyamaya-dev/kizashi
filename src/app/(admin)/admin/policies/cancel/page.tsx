/**
 * A014 キャンセルポリシー管理
 *
 * 設計書 + Q013:
 *  - 開始時刻 1時間前まで無料キャンセル/変更
 *  - 期限内: 半額返金 - 返金手数料 / 期限外: 消化扱い
 *  - 弊社都合 / 講師都合: 全額返金
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { upsertCancelPolicyAction } from '@/lib/admin/policy-actions';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。',
  update_failed: '更新に失敗しました。',
};

const RULE_OPTIONS = [
  { value: 'full_return', label: 'チケット全額返却' },
  { value: 'half_refund_fee', label: '半額 - 返金手数料 (Q013)' },
  { value: 'no_return', label: 'チケット消化（返却なし）' },
] as const;

export default async function CancelPolicyPage({
  searchParams,
}: {
  searchParams: { updated?: string; error?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: policy } = await supabase
    .from('cancel_policies')
    .select('*')
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  const flash = searchParams.updated ? 'ポリシーを更新しました' : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">キャンセルポリシー設定</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          現行ポリシーを変更すると履歴として保存され、以降の予約に適用されます
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

      <form action={upsertCancelPolicyAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>無料キャンセル / 変更（Q013）</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="free_cancel_minutes_before_start">無料キャンセル可能時間（開始前 分）</Label>
              <Input
                id="free_cancel_minutes_before_start"
                name="free_cancel_minutes_before_start"
                type="number"
                min={0}
                required
                defaultValue={policy?.free_cancel_minutes_before_start ?? 60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="free_change_minutes_before_start">無料変更可能時間（開始前 分）</Label>
              <Input
                id="free_change_minutes_before_start"
                name="free_change_minutes_before_start"
                type="number"
                min={0}
                required
                defaultValue={policy?.free_change_minutes_before_start ?? 60}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>変更・キャンセル期限（既定の表示用）</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="change_deadline_hours">変更期限（時間前）</Label>
              <Input
                id="change_deadline_hours"
                name="change_deadline_hours"
                type="number"
                min={0}
                required
                defaultValue={policy?.change_deadline_hours ?? 24}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancel_deadline_hours">キャンセル期限（時間前）</Label>
              <Input
                id="cancel_deadline_hours"
                name="cancel_deadline_hours"
                type="number"
                min={0}
                required
                defaultValue={policy?.cancel_deadline_hours ?? 24}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>チケット返却ルール</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                key: 'ticket_return_rule_in_deadline',
                label: '生徒都合・期限内',
                desc: 'free_cancel_minutes 以内のキャンセル',
                defaultValue: policy?.ticket_return_rule_in_deadline ?? 'full_return',
              },
              {
                key: 'ticket_return_rule_out_deadline',
                label: '生徒都合・期限外',
                desc: 'free_cancel_minutes を超えてからのキャンセル',
                defaultValue: policy?.ticket_return_rule_out_deadline ?? 'no_return',
              },
              {
                key: 'ticket_return_rule_company',
                label: '弊社都合',
                desc: 'システム障害・運営判断によるキャンセル',
                defaultValue: policy?.ticket_return_rule_company ?? 'full_return',
              },
              {
                key: 'ticket_return_rule_instructor',
                label: '講師都合',
                desc: '講師による予約キャンセル (Q014)',
                defaultValue: policy?.ticket_return_rule_instructor ?? 'full_return',
              },
            ].map((row) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-3 sm:items-start">
                <div>
                  <Label htmlFor={row.key}>{row.label}</Label>
                  <p className="text-xs text-muted-foreground">{row.desc}</p>
                </div>
                <select
                  id={row.key}
                  name={row.key}
                  defaultValue={row.defaultValue}
                  className="col-span-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {RULE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">ポリシーを更新</Button>
        </div>
      </form>
    </div>
  );
}
