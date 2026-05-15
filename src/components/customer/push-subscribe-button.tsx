'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff } from 'lucide-react';

interface Props {
  vapidPublicKey: string;
}

/**
 * Web Push 購読ボタン
 *
 * - 未対応ブラウザ → 非表示
 * - 未許可 → 「通知を受け取る」
 * - 許可済 → 「通知を解除」
 * - 許可拒否 → 「ブラウザ設定から有効化してください」表示
 */
export function PushSubscribeButton({ vapidPublicKey }: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          setSubscribed(false);
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {
        setSubscribed(false);
      }
    })();
  }, []);

  if (supported === false) {
    return null;
  }

  if (permission === 'denied') {
    return (
      <p className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900">
        Push 通知がブロックされています。ブラウザの通知設定から「許可」にしてください。
      </p>
    );
  }

  const subscribe = async () => {
    setBusy(true);
    try {
      // Service Worker 登録
      const reg = await navigator.serviceWorker.register('/sw.js');
      // 権限要求
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setBusy(false);
        return;
      }
      // 既存購読確認
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }
      const j = sub.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: j.endpoint,
          keys: { p256dh: j.keys?.p256dh, auth: j.keys?.auth },
          userAgent: navigator.userAgent,
        }),
      });
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: 'DELETE',
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  };

  return subscribed ? (
    <Button onClick={unsubscribe} variant="outline" disabled={busy} size="sm">
      <BellOff className="mr-2 h-4 w-4" />
      Push 通知を解除
    </Button>
  ) : (
    <Button onClick={subscribe} disabled={busy} size="sm">
      <Bell className="mr-2 h-4 w-4" />
      Push 通知を受け取る
    </Button>
  );
}

/**
 * Base64URL → Uint8Array（applicationServerKey 用）
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
