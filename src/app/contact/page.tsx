/**
 * お問い合わせページ
 *
 * 顧客からのトラブル / 質問の受け口。
 * 送信は POST /api/contact (Resend で運営者宛に通知)。
 */
import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public/site-header';
import { PublicFooter } from '@/components/public/site-footer';
import { ContactForm } from '@/components/public/contact-form';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `お問い合わせ | ${siteConfig.serviceName}`,
  description: 'Kizashi のお問い合わせ窓口です。',
};

export default function ContactPage() {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">お問い合わせ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          サービスについてのご質問・予約に関するお困りごと・ご意見はこちらからお送りください。 通常
          2 営業日以内にご返信いたします。
        </p>

        <div className="mt-6 rounded-lg border bg-card p-6 text-sm">
          <p className="font-semibold">緊急のご連絡</p>
          <p className="mt-2 text-muted-foreground">
            レッスン直前のトラブル等、緊急のご連絡は下記までお電話ください。
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              <span className="text-muted-foreground">電話:</span>{' '}
              <a href={`tel:${siteConfig.operatorPhone.replace(/-/g, '')}`} className="font-mono">
                {siteConfig.operatorPhone}
              </a>
            </li>
            <li>
              <span className="text-muted-foreground">受付:</span> {siteConfig.contactHours}
            </li>
            <li>
              <span className="text-muted-foreground">メール:</span>{' '}
              <a href={`mailto:${siteConfig.contactEmail}`} className="underline">
                {siteConfig.contactEmail}
              </a>
            </li>
          </ul>
        </div>

        <ContactForm className="mt-8" />
      </main>
      <PublicFooter />
    </>
  );
}
