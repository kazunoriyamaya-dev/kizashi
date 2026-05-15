'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORY_LABELS, RANK_LABELS, type Category, type InstructorRank } from '@/types';

const ALL_CATEGORIES: Category[] = ['learning', 'sports', 'art'];
const ALL_RANKS: InstructorRank[] = ['gold', 'silver', 'bronze', 'regular'];
const ALL_TRANSPORT = [
  { value: 'train', label: '電車' },
  { value: 'car', label: '車（30円/km）' },
] as const;

export interface InstructorFormDefaultValues {
  real_name?: string;
  real_name_kana?: string;
  nickname?: string;
  contact_email?: string;
  contact_phone?: string;
  public_bio?: string;
  avatar_url?: string;
  categories?: Category[];
  genres?: string[];
  rank?: InstructorRank;
  transportation_mode?: 'train' | 'car';
  priority?: number;
  base_address?: {
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    address_line?: string;
    building?: string | null;
  };
}

interface InstructorFormProps {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: InstructorFormDefaultValues;
  submitLabel?: string;
  cancelHref?: string;
}

export function InstructorForm({
  action,
  defaultValues = {},
  submitLabel = '登録',
  cancelHref = '/admin/instructors',
}: InstructorFormProps) {
  const [genresText, setGenresText] = useState((defaultValues.genres ?? []).join(','));

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">本名・連絡先（非公開）</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="real_name">本名</Label>
            <Input
              id="real_name"
              name="real_name"
              required
              defaultValue={defaultValues.real_name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="real_name_kana">本名フリガナ</Label>
            <Input
              id="real_name_kana"
              name="real_name_kana"
              required
              defaultValue={defaultValues.real_name_kana}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_email">連絡先メール</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              required
              defaultValue={defaultValues.contact_email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_phone">電話番号（任意）</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={defaultValues.contact_phone ?? ''}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">公開プロフィール</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nickname">ニックネーム（公開）</Label>
            <Input id="nickname" name="nickname" required defaultValue={defaultValues.nickname} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar_url">顔写真 URL（任意）</Label>
            <Input
              id="avatar_url"
              name="avatar_url"
              type="url"
              defaultValue={defaultValues.avatar_url ?? ''}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="public_bio">自己紹介</Label>
          <Textarea
            id="public_bio"
            name="public_bio"
            rows={4}
            defaultValue={defaultValues.public_bio ?? ''}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">対応カテゴリ・ジャンル</h2>
        <div className="space-y-2">
          <Label>対応カテゴリ（必須）</Label>
          <div className="flex flex-wrap gap-4">
            {ALL_CATEGORIES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <Checkbox
                  name="categories"
                  value={c}
                  defaultChecked={defaultValues.categories?.includes(c)}
                />
                <span>{CATEGORY_LABELS[c]}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="genres-text">対応ジャンル（カンマ区切り、任意）</Label>
          <Input
            id="genres-text"
            value={genresText}
            onChange={(e) => setGenresText(e.target.value)}
            placeholder="例: ピアノ,絵画,英会話"
          />
          {genresText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((g, idx) => (
              <input key={`${g}-${idx}`} type="hidden" name="genres" value={g} />
            ))}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">講師ランクと移動手段</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rank">ランク（指名料に紐づく）</Label>
            <select
              id="rank"
              name="rank"
              required
              defaultValue={defaultValues.rank ?? 'regular'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ALL_RANKS.map((r) => (
                <option key={r} value={r}>
                  {RANK_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transportation_mode">移動手段</Label>
            <select
              id="transportation_mode"
              name="transportation_mode"
              required
              defaultValue={defaultValues.transportation_mode ?? 'train'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ALL_TRANSPORT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">体験割当優先度</Label>
            <Input
              id="priority"
              name="priority"
              type="number"
              min={0}
              max={1000}
              defaultValue={defaultValues.priority ?? 0}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">自宅住所（交通費計算用 / 非公開）</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="base_address.postal_code">郵便番号</Label>
            <Input
              id="base_address.postal_code"
              name="base_address.postal_code"
              placeholder="160-0023"
              defaultValue={defaultValues.base_address?.postal_code ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="base_address.prefecture">都道府県</Label>
            <Input
              id="base_address.prefecture"
              name="base_address.prefecture"
              defaultValue={defaultValues.base_address?.prefecture ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="base_address.city">市区町村</Label>
            <Input
              id="base_address.city"
              name="base_address.city"
              defaultValue={defaultValues.base_address?.city ?? ''}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="base_address.address_line">町域・番地</Label>
          <Input
            id="base_address.address_line"
            name="base_address.address_line"
            required
            defaultValue={defaultValues.base_address?.address_line ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="base_address.building">建物名・部屋番号（任意）</Label>
          <Input
            id="base_address.building"
            name="base_address.building"
            defaultValue={defaultValues.base_address?.building ?? ''}
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <a href={cancelHref}>キャンセル</a>
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
