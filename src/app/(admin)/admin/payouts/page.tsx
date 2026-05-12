/**
 * A017 管理者 精算管理
 *
 * - 対象月選択
 * - 「集計を実行」ボタン
 * - 講師別 payouts 一覧
 * - 個別 confirm / pay 操作
 * - CSV ダウンロード
 */
import Link from 'next/link';
import { listPayouts } from '@/lib/payouts/calculate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatJPY } from '@/lib/utils';
import {
  runMonthlyPayoutComputationAction,
  confirmPayoutAction,
  payInstructorAction,
} from '@/lib/admin/payout-actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_period: '対象月の形式が不正です (YYYY-MM)',
  compute_failed: '集計に失敗しました',
  confirm_failed: '確定に失敗しました',
  not_found: '対象の精算が見つかりません',
  not_confirmed: 'まず確定 (confirm) してください',
  connect_not_ready: 'Stripe Connect の準備が完了していません',
  zero_amount: '支払額が 0 円のため Transfer 不可',
  transfer_failed: 'Stripe Transfer に失敗しました',
};

function defaultPeriod() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1); // 先月をデフォルト
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: {
    period?: string;
    computed?: string;
    confirmed?: string;
    paid?: string;
    error?: string;
  };
}) {
  const period = searchParams.period ?? defaultPeriod();
  const rows = await listPayouts(`${period}-01`);

  const flash = searchParams.computed
    ? '集計を実行しました'
    : searchParams.confirmed
      ? '精算を確定しました'
      : searchParams.paid
        ? '支払いを実行しました'
        : null;
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  const totalAmount = rows.reduce((sum, r) => sum + r.instructorAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">精算管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          月末締め、翌月末払い (Q011)。実 Stripe 手数料を控除した上で 50% を講師取り分とする
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">対象月</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={runMonthlyPayoutComputationAction} className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="period_month" className="text-xs">
                対象月 (YYYY-MM)
              </Label>
              <Input
                id="period_month"
                name="period_month"
                type="month"
                required
                defaultValue={period}
                className="h-9"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="recompute" />
              <span>確定/支払い済みも再計算する (検証用)</span>
            </label>
            <Button type="submit">集計を実行</Button>
            <Button asChild variant="outline">
              <a href={`/api/admin/payouts/csv?period=${period}`} target="_blank" rel="noopener noreferrer">
                CSV ダウンロード
              </a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {period} の精算 ({rows.length} 件 ・ 合計 {formatJPY(totalAmount)})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              この月に確定する精算はありません。「集計を実行」を押してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>講師</TableHead>
                  <TableHead className="text-right">売上</TableHead>
                  <TableHead className="text-right">Stripe手数料</TableHead>
                  <TableHead className="text-right">指名料</TableHead>
                  <TableHead className="text-right">交通費</TableHead>
                  <TableHead className="text-right">支払額</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>Connect</TableHead>
                  <TableHead>インボイス</TableHead>
                  <TableHead className="w-40">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        href={`/admin/instructors/${r.instructorId}`}
                        className="font-medium underline"
                      >
                        {r.instructorNickname}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">{r.instructorRealName}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatJPY(r.grossAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      -{formatJPY(r.stripeFeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      +{formatJPY(r.designationFeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      +{formatJPY(r.travelFeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatJPY(r.instructorAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === 'paid'
                            ? 'success'
                            : r.status === 'confirmed'
                              ? 'default'
                              : r.status === 'cancelled'
                                ? 'destructive'
                                : 'secondary'
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.payoutsEnabled ? (
                        <Badge variant="success" className="text-xs">
                          ○
                        </Badge>
                      ) : r.hasConnectAccount ? (
                        <Badge variant="warning" className="text-xs">
                          設定中
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          未連携
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.invoiceRegistrationNo ?? '–'}
                    </TableCell>
                    <TableCell className="space-y-1">
                      {r.status === 'draft' && (
                        <form action={confirmPayoutAction.bind(null, r.id)}>
                          <input type="hidden" name="period" value={period} />
                          <Button type="submit" size="sm" variant="outline" className="w-full">
                            確定
                          </Button>
                        </form>
                      )}
                      {r.status === 'confirmed' && r.payoutsEnabled && r.instructorAmount > 0 && (
                        <form action={payInstructorAction.bind(null, r.id)}>
                          <input type="hidden" name="period" value={period} />
                          <Button type="submit" size="sm" className="w-full">
                            支払う
                          </Button>
                        </form>
                      )}
                      {r.status === 'paid' && r.stripeTransferId && (
                        <span className="block text-[10px] font-mono text-muted-foreground">
                          {r.stripeTransferId}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6 text-xs text-muted-foreground">
          <p className="font-semibold">計算式 (Q010 / Q011)</p>
          <p>取り分 = (チケット消化売上 − 実Stripe手数料) × 50% + 指名料 + 交通費</p>
          <p>※ Stripe 手数料は payments.stripe_fee を予約金額で按分</p>
          <p>※ 業務委託費 (Q012)。インボイス未登録の講師は番号空欄</p>
        </CardContent>
      </Card>
    </div>
  );
}
