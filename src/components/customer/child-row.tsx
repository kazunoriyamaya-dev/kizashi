'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, X } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  kana: string;
  birth_date: string;
  notes: string | null;
  trial_used: boolean;
}

interface ChildRowProps {
  child: Child;
  updateAction: (id: string, formData: FormData) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
}

export function ChildRow({ child, updateAction, deleteAction }: ChildRowProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <div className="font-medium">{child.name}</div>
          <div className="text-xs text-muted-foreground">
            {child.kana} ・ {new Date(child.birth_date).toLocaleDateString('ja-JP')}
            {child.trial_used ? ' ・ 体験済' : ' ・ 体験未使用'}
          </div>
          {child.notes && <p className="mt-1 text-xs text-muted-foreground">{child.notes}</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!child.trial_used && (
            <form action={deleteAction.bind(null, child.id)}>
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={updateAction.bind(null, child.id)} className="rounded-md border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`name-${child.id}`} className="text-xs">
            お名前
          </Label>
          <Input
            id={`name-${child.id}`}
            name="name"
            required
            defaultValue={child.name}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`kana-${child.id}`} className="text-xs">
            フリガナ
          </Label>
          <Input
            id={`kana-${child.id}`}
            name="kana"
            required
            defaultValue={child.kana}
          />
        </div>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`birth-${child.id}`} className="text-xs">
            生年月日
          </Label>
          <Input
            id={`birth-${child.id}`}
            name="birth_date"
            type="date"
            required
            defaultValue={child.birth_date}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`notes-${child.id}`} className="text-xs">
            メモ（任意）
          </Label>
          <Input
            id={`notes-${child.id}`}
            name="notes"
            maxLength={200}
            defaultValue={child.notes ?? ''}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          <X className="mr-1 h-3.5 w-3.5" />
          キャンセル
        </Button>
        <Button type="submit" size="sm">
          保存
        </Button>
      </div>
    </form>
  );
}
