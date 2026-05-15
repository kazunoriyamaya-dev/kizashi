'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  className?: string;
}

const TOPICS = [
  '体験予約について',
  '予約の変更・キャンセル',
  '決済・チケットについて',
  'アカウント / ログイン',
  '講師・レッスン内容',
  'その他',
];

export function ContactForm({ className }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [body, setBody] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setErrorMsg('プライバシーポリシーへの同意が必要です');
      return;
    }
    if (body.trim().length < 10) {
      setErrorMsg('お問い合わせ内容は 10 文字以上で記入してください');
      return;
    }
    setErrorMsg(null);
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, topic, body }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'send_failed');
      }
      setState('success');
    } catch (e) {
      setErrorMsg(
        e instanceof Error && e.message === 'rate_limited'
          ? '短時間に多数のお問い合わせを送信されています。しばらく時間をおいて再度お試しください。'
          : '送信に失敗しました。時間をおいて再度お試しいただくか、お電話でご連絡ください。',
      );
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className={className}>
        <div className="rounded-md border border-green-300 bg-green-50 p-6 text-sm text-green-900">
          <p className="font-semibold">お問い合わせを送信しました。</p>
          <p className="mt-2">
            通常 2 営業日以内にご入力のメールアドレス宛にご返信いたします。
            返信が届かない場合、迷惑メールフォルダもご確認ください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      <div className="grid gap-4">
        <div className="space-y-1">
          <Label htmlFor="contact-name">お名前</Label>
          <Input
            id="contact-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact-email">メールアドレス</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact-topic">お問い合わせ種別</Label>
          <select
            id="contact-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="contact-body">お問い合わせ内容</Label>
          <Textarea
            id="contact-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            required
            minLength={10}
            maxLength={4000}
          />
          <p className="text-xs text-muted-foreground">10 〜 4000 文字</p>
        </div>
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              プライバシーポリシー
            </a>
            に同意のうえ送信します。
          </span>
        </label>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <div>
          <Button type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? '送信中…' : '送信する'}
          </Button>
        </div>
      </div>
    </form>
  );
}
