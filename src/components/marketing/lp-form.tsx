'use client';

/**
 * LP の購読フォーム
 *
 * /api/marketing/subscribe に POST する。成功時に thank-you 表示。
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  landingPageId: string;
  sequenceId: string | null;
  submitLabel?: string;
  trialCtaUrl?: string;
}

export function LandingPageSubscribeForm({
  landingPageId,
  sequenceId,
  submitLabel,
  trialCtaUrl,
}: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agreed) {
      setError('プライバシーポリシーへの同意が必要です');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const res = await fetch('/api/marketing/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || null,
          landingPageId,
          sequenceIds: sequenceId ? [sequenceId] : undefined,
          source: 'lp',
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? '送信に失敗しました');
      }
      setState('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="mt-4 space-y-3 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800">
        <p>ご登録ありがとうございます。確認メールをお送りします。</p>
        {trialCtaUrl && (
          <a
            href={trialCtaUrl}
            className="inline-block rounded-md bg-primary px-6 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
          >
            続けて無料体験レッスンを予約する →
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="lp-email">メールアドレス</Label>
        <Input
          id="lp-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="lp-name">お名前 (任意)</Label>
        <Input id="lp-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        プライバシーポリシーに同意します
      </label>
      {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={state === 'loading'}>
          {state === 'loading' ? '送信中…' : (submitLabel ?? '送信')}
        </Button>
        {trialCtaUrl && (
          <a href={trialCtaUrl} className="text-sm text-primary underline hover:text-primary/80">
            すぐに無料体験を予約したい方はこちら →
          </a>
        )}
      </div>
    </form>
  );
}
