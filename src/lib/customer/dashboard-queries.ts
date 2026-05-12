/**
 * 顧客ダッシュボード用クエリ
 *
 * Q024: 兄弟姉妹間でチケット共有可（customer_id 単位で保有）
 * 体験予約導線は新規顧客（trial_used が false の子供がいる）に強調
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface CustomerDashboardData {
  customerId: string;
  childrenCount: number;
  hasUnusedTrial: boolean;
  totalRemainingTickets: number;
  activeTickets: Array<{
    id: string;
    name: string;
    remaining: number;
    expiresAt: string;
  }>;
  nextReservation: {
    id: string;
    startAt: string;
    instructorNickname: string | null;
    deliveryType: 'online' | 'onsite';
    category: string;
  } | null;
  recentReservationsCount: number;
  totalPaymentAmount: number;
}

export async function fetchCustomerDashboard(profileId: string): Promise<CustomerDashboardData | null> {
  const supabase = createSupabaseServerClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (!customer) return null;

  const now = new Date().toISOString();
  const [
    { data: children },
    { data: tickets },
    { data: nextRsv },
    { count: recentCount },
    { data: payments },
  ] = await Promise.all([
    supabase.from('children').select('id, trial_used').eq('customer_id', customer.id),
    supabase
      .from('customer_tickets')
      .select(
        `id, remaining_count, expires_at,
         tickets!customer_tickets_ticket_id_fkey ( name )`,
      )
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .gt('remaining_count', 0)
      .order('expires_at', { ascending: true }),
    supabase
      .from('reservations')
      .select(
        `id, start_at, delivery_type, category,
         instructors!reservations_instructor_id_fkey ( nickname )`,
      )
      .eq('customer_id', customer.id)
      .gte('start_at', now)
      .in('status', ['confirmed', 'changed', 'pending_payment'])
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customer.id),
    supabase
      .from('payments')
      .select('amount')
      .eq('customer_id', customer.id)
      .eq('status', 'paid'),
  ]);

  const totalRemainingTickets = (tickets ?? []).reduce(
    (sum, t) => sum + (t.remaining_count ?? 0),
    0,
  );

  const totalPaymentAmount = (payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return {
    customerId: customer.id,
    childrenCount: children?.length ?? 0,
    hasUnusedTrial: !!children?.some((c) => !c.trial_used),
    totalRemainingTickets,
    activeTickets: (tickets ?? []).slice(0, 5).map((t) => ({
      id: t.id,
      name: t.tickets?.name ?? 'チケット',
      remaining: t.remaining_count,
      expiresAt: t.expires_at,
    })),
    nextReservation: nextRsv
      ? {
          id: nextRsv.id,
          startAt: nextRsv.start_at,
          instructorNickname: nextRsv.instructors?.nickname ?? null,
          deliveryType: nextRsv.delivery_type as 'online' | 'onsite',
          category: nextRsv.category as string,
        }
      : null,
    recentReservationsCount: recentCount ?? 0,
    totalPaymentAmount,
  };
}
