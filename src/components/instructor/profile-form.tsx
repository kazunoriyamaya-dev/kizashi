'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORY_LABELS, type Category } from '@/types';

const ALL_CATEGORIES: Category[] = ['learning', 'sports', 'art'];

export interface InstructorProfileDefaults {
  nickname?: string;
  avatar_url?: string;
  public_bio?: string;
  contact_phone?: string;
  categories?: Category[];
  genres?: string[];
  transportation_mode?: 'train' | 'car';
  base_address?: {
    postal_code?: string | null;
    prefecture?: string | null;
    city?: string | null;
    address_line?: string;
    building?: string | null;
  };
}

interface Props {
  action: (formData: FormData) => Promise<void>;
  defaultValues: InstructorProfileDefaults;
}

export function InstructorProfileForm({ action, defaultValues }: Props) {
  const [genresText, setGenresText] = useState((defaultValues.genres ?? []).join(','));

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">公開プロフィール</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nickname">ニックネーム（公開）</Label>
            <Input id="nickname" name="nickname" required defaultValue={defaultValues.nickname} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar_url">顔写真 URL</Label>
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
            rows={5}
            defaultValue={defaultValues.public_bio ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">連絡用電話番号（管理者のみ閲覧）</Label>
          <Input
            id="contact_phone"
            name="contact_phone"
            defaultValue={defaultValues.contact_phone ?? ''}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-base font-semibold">対応カテゴリ・ジャンル</h2>
        <div className="space-y-2">
          <Label>対応カテゴリ</Label>
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
          <Label htmlFor="genres-text">対応ジャンル（カンマ区切り）</Label>
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
        <h2 className="text-base font-semibold">移動手段と自宅住所（交通費計算用）</h2>
        <div className="space-y-2">
          <Label htmlFor="transportation_mode">移動手段</Label>
          <select
            id="transportation_mode"
            name="transportation_mode"
            required
            defaultValue={defaultValues.transportation_mode ?? 'train'}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-xs"
          >
            <option value="train">電車</option>
            <option value="car">車（30円/km）</option>
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="base_address.postal_code">郵便番号</Label>
            <Input
              id="base_address.postal_code"
              name="base_address.postal_code"
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
          <Label htmlFor="base_address.building">建物名・部屋番号</Label>
          <Input
            id="base_address.building"
            name="base_address.building"
            defaultValue={defaultValues.base_address?.building ?? ''}
          />
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <a href="/instructor/profile">キャンセル</a>
        </Button>
        <Button type="submit">保存</Button>
      </div>
    </form>
  );
}
