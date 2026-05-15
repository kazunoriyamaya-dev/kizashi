import { PublicHeader } from '@/components/public/site-header';
import { PublicFooter } from '@/components/public/site-footer';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">{children}</main>
      <PublicFooter />
    </>
  );
}
