'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORY_LABELS, type Category, type LessonFormat } from '@/types';

const CATEGORIES: Array<{ value: Category | '__common__'; label: string }> = [
  { value: '__common__', label: '共通（全カテゴリ）' },
  { value: 'learning', label: CATEGORY_LABELS.learning },
  { value: 'sports', label: CATEGORY_LABELS.sports },
  { value: 'art', label: CATEGORY_LABELS.art },
];

export interface TicketFormDefaults {
  name?: string;
  description?: string;
  category?: Category | null;
  price?: number;
  session_count?: number;
  valid_days?: number;
  duration_min?: number;
  lesson_format?: LessonFormat;
  sort_order?: number;
  status?: 'active' | 'inactive' | 'deleted';
}

interface TicketFormProps {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: TicketFormDefaults;
  submitLabel?: string;
  cancelHref?: string;
}

export function TicketForm({
  action,
  defaultValues = {},
  submitLabel = '登録',
  cancelHref = '/admin/tickets',
}: TicketFormProps) {
  const categoryDefault: Category | '__common__' = defaultValues.category ?? '__common__';

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">基本情報</h2>
        <div className="space-y-2">
          <Label htmlFor="name">チケット名</Label>
          <Input id="name" name="name" required defaultValue={defaultValues.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">説明（任意）</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={defaultValues.description ?? ''}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">レッスン仕様</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="duration_min">レッスン時間（分）</Label>
            <select
              id="duration_min"
              name="duration_min"
              required
              defaultValue={defaultValues.duration_min ?? 60}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} 分
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lesson_format">レッスン形式</Label>
            <select
              id="lesson_format"
              name="lesson_format"
              required
              defaultValue={defaultValues.lesson_format ?? 'solo'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="solo">単独</option>
              <option value="pair">ペア (Q001)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">対象カテゴリ</Label>
            <select
              id="category"
              name="category"
              required
              defaultValue={categoryDefault}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">価格・回数・有効期限</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="price">価格（円・税込）</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              required
              defaultValue={defaultValues.price ?? 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session_count">回数</Label>
            <Input
              id="session_count"
              name="session_count"
              type="number"
              min={1}
              required
              defaultValue={defaultValues.session_count ?? 1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valid_days">有効日数（購入日から）</Label>
            <Input
              id="valid_days"
              name="valid_days"
              type="number"
              min={1}
              max={3650}
              required
              defaultValue={defaultValues.valid_days ?? 90}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">表示・販売状態</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sort_order">表示順（小さいほど上）</Label>
            <Input
              id="sort_order"
              name="sort_order"
              type="number"
              min={0}
              defaultValue={defaultValues.sort_order ?? 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">ステータス</Label>
            <select
              id="status"
              name="status"
              required
              defaultValue={defaultValues.status ?? 'active'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="active">販売中</option>
              <option value="inactive">販売停止</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <a href={cancelHref}>キャンセル</a>
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
