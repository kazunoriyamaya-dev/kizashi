/**
 * 特定商取引法に基づく表記
 *
 * Stripe 本番アカウント審査 + 日本の EC 法定要件。
 * 本文中の事業者情報は src/lib/site-config.ts から取得し、
 * 本番リリース前に値が実情報になっていることを必ず確認すること。
 */
import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `特定商取引法に基づく表記 | ${siteConfig.serviceName}`,
  description: '特定商取引法 第 11 条に基づく表記',
};

const ROWS: Array<{ label: string; value: string }> = [
  { label: '販売事業者名', value: siteConfig.operatorName },
  { label: '運営統括責任者', value: siteConfig.operatorRepresentative },
  { label: '所在地', value: siteConfig.operatorAddress },
  { label: '電話番号', value: siteConfig.operatorPhone },
  {
    label: '電話受付時間',
    value: `${siteConfig.contactHours}（迅速な対応のため、原則メールでのお問い合わせをお願いしております）`,
  },
  { label: 'メールアドレス', value: siteConfig.contactEmail },
  { label: 'ホームページ URL', value: siteConfig.appUrl },
  {
    label: '販売価格',
    value:
      '各チケット商品ページに税込価格で表示します。表示価格以外の費用は発生しません（オプションで講師の交通費が発生する場合は予約画面で明示されます）。',
  },
  {
    label: '商品代金以外の必要料金',
    value:
      '通信料金はお客様のご負担となります。対面レッスンを選択した場合の講師交通費は予約フォームで提示の上、チケット代金と別途お支払いいただきます。',
  },
  {
    label: 'お支払い方法',
    value: 'クレジットカード決済 (Visa / Mastercard / JCB / AMEX / Diners)',
  },
  {
    label: '支払時期',
    value: 'チケット購入時に即時決済されます。',
  },
  {
    label: 'サービス提供時期',
    value:
      'お支払い完了後、ただちにチケットがアカウントに付与されます。レッスンはチケットの有効期限内にご予約ください。',
  },
  {
    label: 'チケット有効期限',
    value:
      '各チケット商品ページに記載 (購入日から起算)。有効期限を過ぎたチケットは失効し、返金はできません。',
  },
  {
    label: 'キャンセル・返品',
    value:
      'デジタルサービスの性質上、購入後のキャンセル・返金はお受けしておりません。ただし、当社都合・講師都合でレッスンが提供できなかった場合は、該当回数を返戻もしくは振替対応いたします。詳細は「利用規約」をご確認ください。',
  },
  {
    label: 'レッスンキャンセルポリシー',
    value:
      'レッスン開始 1 時間前までのキャンセルはチケット 1 回分を返却します。それ以降は消化扱いとなります（講師・当社都合での中止は除く）。',
  },
  {
    label: '動作環境',
    value:
      '最新版の Chrome / Safari / Edge / Firefox。スマートフォンは iOS 16 以上 / Android 10 以上を推奨します。オンラインレッスンは Google Meet を利用します。',
  },
];

export default function TokushohoPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold">特定商取引法に基づく表記</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        特定商取引に関する法律 第 11 条に基づき、以下のとおり表記します。
      </p>

      <div className="mt-8 overflow-hidden rounded-lg border">
        <dl className="divide-y">
          {ROWS.map((r) => (
            <div key={r.label} className="grid gap-1 px-4 py-4 sm:grid-cols-[200px_1fr]">
              <dt className="text-sm font-semibold text-muted-foreground">{r.label}</dt>
              <dd className="text-sm leading-relaxed">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        最終更新日: {new Date().toISOString().slice(0, 10)}
      </p>
    </article>
  );
}
