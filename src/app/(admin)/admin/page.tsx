/**
 * A002 管理者ダッシュボード
 *
 * 表示項目: 講師人数 / 顧客数 / チケット売上 (枚数 / 金額) / 予約数
 *  + 直近の体験予約管理者確認待ち件数
 *  + 今後の予約数 (start_at >= now())
 */
import {
  GraduationCap,
  Users,
  Ticket,
  Calendar,
  AlertCircle,
  ClipboardCheck,
} from 'lucide-react';
import { fetchAdminDashboardKpi } from '@/lib/admin/dashboard-queries';
import { KpiCard } from '@/components/admin/kpi-card';
import { formatJPY } from '@/lib/utils';

export default async function AdminDashboardPage() {
  const kpi = await fetchAdminDashboardKpi();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="mt-1 text-sm text-muted-foreground">主要 KPI のサマリー</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="講師数 (active)"
          value={kpi.instructorCount}
          hint="招待中・停止中を除く"
          Icon={GraduationCap}
        />
        <KpiCard label="顧客数" value={kpi.customerCount} Icon={Users} />
        <KpiCard
          label="チケット売上"
          value={formatJPY(kpi.ticketSoldAmount)}
          hint={`${kpi.ticketSoldCount} 件`}
          Icon={Ticket}
        />
        <KpiCard label="予約数 (累計)" value={kpi.reservationCount} Icon={Calendar} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="今後の予約"
          value={kpi.upcomingReservationCount}
          hint="今日以降で confirmed/pending の予約"
          Icon={ClipboardCheck}
          accent="success"
        />
        <KpiCard
          label="体験予約 確認待ち"
          value={kpi.pendingTrialReviewCount}
          hint="子供情報重複のため管理者承認が必要"
          Icon={AlertCircle}
          accent={kpi.pendingTrialReviewCount > 0 ? 'warning' : 'default'}
        />
      </section>
    </div>
  );
}
