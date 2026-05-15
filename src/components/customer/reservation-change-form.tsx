'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { changeOwnReservationAction } from '@/lib/customer/reservation-modify-actions';

interface Slot {
  start: string;
  end: string;
}

interface Props {
  reservationId: string;
  instructorId: string;
  durationMin: number;
  deliveryType: 'online' | 'onsite';
  currentStartIso: string;
}

/**
 * 顧客予約変更フォーム
 *
 * - 既存予約の duration_min を保持して空き枠を取得
 * - 新しい時刻を選択して送信
 */
export function ReservationChangeForm({
  reservationId,
  instructorId,
  durationMin,
  deliveryType,
  currentStartIso,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(false);

  const [dateOffset, setDateOffset] = useState(0);
  const fromDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dateOffset);
    return d;
  }, [dateOffset]);
  const toDate = useMemo(() => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + 7);
    return d;
  }, [fromDate]);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const url = new URL(`/api/customer/instructors/${instructorId}/slots`, window.location.origin);
    url.searchParams.set('from', fromDate.toISOString());
    url.searchParams.set('to', toDate.toISOString());
    url.searchParams.set('duration_min', String(durationMin));
    url.searchParams.set('delivery', deliveryType);
    url.searchParams.set('step_min', '30');
    fetch(url.toString())
      .then((r) => r.json())
      .then((j: { slots?: Slot[] }) => setSlots(j.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [instructorId, durationMin, deliveryType, fromDate, toDate]);

  const slotsByDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = new Date(s.start).toISOString().slice(0, 10);
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort();
  }, [slots]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData();
    fd.set('start_at', selected.start);
    fd.set('end_at', selected.end);
    startTransition(async () => {
      await changeOwnReservationAction(reservationId, fd);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <p className="text-xs text-muted-foreground">
            現在の予約日時: {new Date(currentStartIso).toLocaleString('ja-JP')}
          </p>
          <Label>新しい予約枠を選択</Label>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateOffset((d) => Math.max(0, d - 7))}
              disabled={dateOffset === 0}
            >
              ← 前週
            </Button>
            <span className="text-xs text-muted-foreground">
              {fromDate.toLocaleDateString('ja-JP')} 〜
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDateOffset((d) => d + 7)}
            >
              翌週 →
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground">空き枠を取得中…</p>
          ) : slotsByDay.length === 0 ? (
            <p className="text-muted-foreground">この週には空き枠がありません</p>
          ) : (
            <div className="space-y-3">
              {slotsByDay.map(([day, dailySlots]) => (
                <div key={day}>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                    {new Date(day).toLocaleDateString('ja-JP', {
                      month: '2-digit',
                      day: '2-digit',
                      weekday: 'short',
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dailySlots.map((s) => {
                      const t = new Date(s.start).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const active = selected?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelected(s)}
                          className={
                            'rounded-md border px-3 py-1.5 text-sm transition-colors ' +
                            (active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'hover:border-primary')
                          }
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="submit" size="lg" className="w-full" disabled={!selected || isPending}>
          {isPending ? '変更中…' : '予約を変更する'}
        </Button>
      </div>
    </form>
  );
}
