import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Kizashi予約管理システム',
    template: '%s | Kizashi',
  },
  description: '小中学生向けパーソナルサービス Kizashi の予約管理システム',
  applicationName: 'Kizashi',
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: false, // MVP段階では検索インデックス不可
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={cn(notoSansJp.variable, 'min-h-screen font-sans antialiased')}>
        {children}
      </body>
    </html>
  );
}
