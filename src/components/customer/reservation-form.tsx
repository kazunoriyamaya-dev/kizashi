'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CATEGORY_LABELS, type Category } from '@/types';
import { formatJPY } from '@/lib/utils';
import { createNormalReservationAction } from '@/lib/customer/reservation-actions';

interface ChildOption {
  id: string;
  name: string;
  kana: string;
}

interface TicketOption {
  id: string;
  ticket_name: string;
  duration_min: number;
  lesson_format: 'solo' | 'pair';
  remaining_count: number;
  expires_at: string;
  category: Category | null;
}

interface InstructorBrief {
  id: string;
  nickname: string;
  avatar_url: string | null;
  categories: Category[];
  rank: 'gold' | 'silver' | 'bronze' | 'regular';
  designation_fee: number;
}

interface Slot {
  start: string;
  end: string;
}

interface Props {
  instructor: InstructorBrief;
  childrenList: ChildOption[];
  tickets: TicketOption[];
  defaultCategory: Category;
}

export function ReservationForm({
  instructor,
  childrenList: children,
  tickets,
  defaultCategory,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [childId, setChildId] = useState(children[0]?.id ?? '');
  const [customerTicketId, setCustomerTicketId] = useState(tickets[0]?.id ?? '');
  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === customerTicketId) ?? null,
    [customerTicketId, tickets],
  );
  const [deliveryType, setDeliveryType] = useState<'online' | 'onsite'>('online');
  const [address, setAddress] = useState({
    postal_code: '',
    prefecture: '',
    city: '',
    address_line: '',
    building: '',
  });
  const [category, setCategory] = useState<Category>(defaultCategory);

  // 空き枠取得
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ペア対応
  const [pairChildIds, setPairChildIds] = useState<string[]>([]);
  const [pairFreeText, setPairFreeText] = useState('');

  const today = useMemo(() => new Date(), []);
  const [dateOffset, setDateOffset] = useState(0); // 何日後を起点とする
  const fromDate = useMemo(() => {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + dateOffset);
    return d;
  }, [today, dateOffset]);
  const toDate = useMemo(() => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + 7);
    return d;
  }, [fromDate]);

  useEffect(() => {
    if (!selectedTicket) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    const url = new URL(`/api/customer/instructors/${instructor.id}/slots`, window.location.origin);
    url.searchParams.set('from', fromDate.toISOString());
    url.searchParams.set('to', toDate.toISOString());
    url.searchParams.set('duration_min', String(selectedTicket.duration_min));
    url.searchParams.set('delivery', deliveryType);
    url.searchParams.set('step_min', '30');
    fetch(url.toString())
      .then((r) => r.json())
      .then((j: { slots?: Slot[] }) => setSlots(j.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [instructor.id, selectedTicket, fromDate, toDate, deliveryType]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const d = new Date(s.start);
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort();
  }, [slots]);

  const totalAmount = instructor.designation_fee; // 交通費 Phase 11 で追加

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!childId) return setError('受講するお子様を選択してください');
    if (!customerTicketId || !selectedTicket) return setError('チケットを選択してください');
    if (!selectedSlot) return setError('予約枠を選択してください');
    if (deliveryType === 'onsite' && !address.address_line)
      return setError('対面の場合は実施場所の住所を入力してください');

    const pairParticipants: Array<
      | { type: 'child'; child_id: string }
      | { type: 'free_text'; name: string; note?: string | null }
    > = [];
    if (selectedTicket.lesson_format === 'pair') {
      for (const id of pairChildIds) {
        if (id !== childId) pairParticipants.push({ type: 'child', child_id: id });
      }
      if (pairFreeText.trim()) {
        pairParticipants.push({ type: 'free_text', name: pairFreeText.trim() });
      }
    }

    const fd = new FormData();
    fd.set('instructor_id', instructor.id);
    fd.set('child_id', childId);
    fd.set('customer_ticket_id', customerTicketId);
    fd.set('category', category);
    fd.set('start_at', selectedSlot.start);
    fd.set('end_at', selectedSlot.end);
    fd.set('duration_min', String(selectedTicket.duration_min));
    fd.set('delivery_type', deliveryType);
    if (deliveryType === 'onsite') {
      fd.set('location_json', JSON.stringify(address));
    }
    fd.set('pair_participants', JSON.stringify(pairParticipants));

    startTransition(async () => {
      await createNormalReservationAction(fd);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-12 w-12">
            {instructor.avatar_url && <AvatarImage src={instructor.avatar_url} />}
            <AvatarFallback>{instructor.nickname.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{instructor.nickname}先生</span>
              <Badge variant="outline" className="text-xs">
                指名料 +{formatJPY(instructor.designation_fee)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {instructor.categories.map((c) => CATEGORY_LABELS[c]).join(' / ')}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. 受講するお子様</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              先にお子様情報を登録してください。プロフィールから追加できます。
            </p>
          ) : (
            children.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-md border p-3">
                <input
                  type="radio"
                  name="child"
                  value={c.id}
                  checked={childId === c.id}
                  onChange={() => setChildId(c.id)}
                />
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.kana}</span>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. チケット選択</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tickets.length === 0 && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm">
              <p className="font-medium text-yellow-900">利用できるチケットがありません</p>
              <p className="mt-1 text-xs text-yellow-800">
                Q024: 兄弟姉妹で残数を共有できます。下のボタンからチケットを購入してください。
              </p>
              <a
                href={`/mypage/tickets?return_to=${encodeURIComponent(`/mypage/reservations/new?instructorId=${instructor.id}`)}`}
                className="mt-2 inline-block rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
              >
                チケットを購入する
              </a>
            </div>
          )}
          {tickets.map((t) => (
            <label
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ticket"
                  value={t.id}
                  checked={customerTicketId === t.id}
                  onChange={() => setCustomerTicketId(t.id)}
                />
                <div>
                  <div className="font-medium">{t.ticket_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.duration_min}分・{t.lesson_format === 'pair' ? 'ペア' : '単独'} ・残
                    {t.remaining_count}回 ・期限{new Date(t.expires_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. カテゴリと形式</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="category">カテゴリ</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {instructor.categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>形式</Label>
            <div className="flex gap-2">
              {[
                { value: 'online', label: 'オンライン (Google Meet)' },
                { value: 'onsite', label: '対面' },
              ].map((o) => (
                <label
                  key={o.value}
                  className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={o.value}
                    checked={deliveryType === o.value}
                    onChange={() => setDeliveryType(o.value as 'online' | 'onsite')}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          {deliveryType === 'onsite' && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">対面の場合は実施場所をご入力ください</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="郵便番号"
                  value={address.postal_code}
                  onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                />
                <Input
                  placeholder="都道府県"
                  value={address.prefecture}
                  onChange={(e) => setAddress({ ...address, prefecture: e.target.value })}
                />
                <Input
                  placeholder="市区町村"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                />
              </div>
              <Input
                placeholder="町域・番地 *"
                required
                value={address.address_line}
                onChange={(e) => setAddress({ ...address, address_line: e.target.value })}
              />
              <Input
                placeholder="建物名（任意）"
                value={address.building}
                onChange={(e) => setAddress({ ...address, building: e.target.value })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTicket?.lesson_format === 'pair' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. ペア参加者 (Q001)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">
              ペアレッスンの相手をお子様から選ぶか、フリーテキストで入力できます
            </p>
            {children
              .filter((c) => c.id !== childId)
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    checked={pairChildIds.includes(c.id)}
                    onChange={(e) =>
                      setPairChildIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      )
                    }
                  />
                  <span>
                    {c.name}（{c.kana}）
                  </span>
                </label>
              ))}
            <Input
              placeholder="または外部参加者の名前を入力"
              value={pairFreeText}
              onChange={(e) => setPairFreeText(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedTicket?.lesson_format === 'pair' ? '5' : '4'}. 予約枠
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

          {slotsLoading ? (
            <p className="text-sm text-muted-foreground">空き枠を取得中…</p>
          ) : slotsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">この週には空き枠がありません</p>
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
                      const active = selectedSlot?.start === s.start;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          onClick={() => setSelectedSlot(s)}
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

      <Card className="border-primary/30">
        <CardContent className="space-y-2 pt-6 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">チケット消化</span>
            <span>1回</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">指名料</span>
            <span>+{formatJPY(instructor.designation_fee)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>合計（追加お支払い）</span>
            <span>{formatJPY(totalAmount)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            対面の場合は別途交通費が発生します（Phase 11 で自動計算）
          </p>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? '予約中…' : '予約を確定する'}
        </Button>
      </div>
    </form>
  );
}
