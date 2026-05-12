'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_token: '招待リンクが無効、または有効期限を過ぎています。',
  instructor_not_found: '講師アカウントが見つかりませんでした。',
  already_activated: 'このアカウントは既に有効化されています。ログイン画面へお進みください。',
  instructor_inactive: 'アカウントが利用停止中です。',
  password_set_failed: 'パスワード設定に失敗しました。',
  invalid_body: '入力内容に誤りがあります。',
};

interface AcceptInviteFormProps {
  token: string;
  expiresAt: string;
}

export function AcceptInviteForm({ token, expiresAt }: AcceptInviteFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('パスワードは 8 文字以上で入力してください。');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('確認用パスワードが一致しません。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/instructor/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        magic_link_redirect?: string;
        login_required?: boolean;
      };
      if (!res.ok || !json.ok) {
        setErrorMsg(ERROR_MESSAGES[json.error ?? ''] ?? '処理に失敗しました。');
        setSubmitting(false);
        return;
      }
      if (json.magic_link_redirect) {
        window.location.href = json.magic_link_redirect;
      } else {
        window.location.href = '/instructor/login?accepted=1';
      }
    } catch {
      setErrorMsg('ネットワークエラーが発生しました。');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {errorMsg && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMsg}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="password">パスワード（8 文字以上）</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">パスワード（確認用）</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? '設定中…' : 'パスワードを設定して開始'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        招待リンクの有効期限: {new Date(expiresAt).toLocaleString('ja-JP')}
      </p>
    </form>
  );
}
