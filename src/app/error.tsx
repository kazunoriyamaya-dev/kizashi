'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * 全画面共通のエラーバウンダリ
 *
 * 個人情報がエラーメッセージに混入しないよう、表示は固定文言とする。
 * 詳細はサーバー側ロガーに任せ、画面にはerror.digestのみ表示する。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Unhandled UI error', { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-muted-foreground">
        しばらく時間をおいて再度お試しください。問題が解消しない場合はサポートまでご連絡ください。
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">参照ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        再試行
      </button>
    </main>
  );
}
