/**
 * 公開 LP /lp/[slug]
 *
 * RLS により published かつ publish_at <= now() <= unpublish_at のレコードのみ閲覧可能。
 * blocks (jsonb) を解釈してセクションを描画する。
 */
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeBlocks } from '@/lib/marketing/landing-pages/render';
import { LandingPageSubscribeForm } from '@/components/marketing/lp-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
}

async function fetchPage(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('marketing_landing_pages')
    .select('id, slug, title, headline, subheadline, blocks, meta_title, meta_description, og_image_url, status')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await fetchPage(params.slug);
  if (!page) return { title: 'Not Found' };
  return {
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? page.headline,
    openGraph: {
      title: page.meta_title ?? page.title,
      description: page.meta_description ?? page.headline,
      images: page.og_image_url ? [{ url: page.og_image_url }] : undefined,
    },
  };
}

export default async function LandingPageRoute({ params }: Props) {
  const page = await fetchPage(params.slug);
  if (!page) notFound();

  // PV をインクリメント (best-effort)
  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc('fn_increment_landing_page_view', { p_lp_id: page.id });
  } catch {
    // ignore
  }

  const blocks = normalizeBlocks(page.blocks);
  const host = headers().get('host') ?? '';

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      {/* Hero (DB の headline を最上部固定で出す) */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{page.headline}</h1>
        {page.subheadline && (
          <p className="mt-4 text-lg text-muted-foreground">{page.subheadline}</p>
        )}
      </header>

      <div className="space-y-12">
        {blocks.map((block, idx) => {
          switch (block.kind) {
            case 'hero':
              return (
                <section key={idx} className="text-center">
                  <h2 className="text-3xl font-bold">{block.headline}</h2>
                  {block.subheadline && (
                    <p className="mt-3 text-muted-foreground">{block.subheadline}</p>
                  )}
                  {block.ctaUrl && block.ctaLabel && (
                    <a
                      href={block.ctaUrl}
                      className="mt-6 inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {block.ctaLabel}
                    </a>
                  )}
                </section>
              );
            case 'feature_list':
              return (
                <section key={idx}>
                  {block.title && <h2 className="mb-6 text-2xl font-bold">{block.title}</h2>}
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {block.items.map((it, j) => (
                      <div key={j} className="rounded-lg border bg-card p-6">
                        <h3 className="font-semibold">{it.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{it.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            case 'testimonial':
              return (
                <section key={idx}>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {block.items.map((it, j) => (
                      <blockquote key={j} className="rounded-lg border bg-card p-6">
                        <p className="text-sm">{it.body}</p>
                        <footer className="mt-3 text-xs text-muted-foreground">
                          — {it.author}
                          {it.role && ` (${it.role})`}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                </section>
              );
            case 'faq':
              return (
                <section key={idx}>
                  <h2 className="mb-6 text-2xl font-bold">よくある質問</h2>
                  <div className="space-y-4">
                    {block.items.map((it, j) => (
                      <details key={j} className="rounded-lg border bg-card p-4">
                        <summary className="cursor-pointer font-medium">{it.q}</summary>
                        <p className="mt-3 text-sm text-muted-foreground">{it.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              );
            case 'cta':
              return (
                <section
                  key={idx}
                  className="rounded-lg bg-primary p-8 text-center text-primary-foreground"
                >
                  <h2 className="text-2xl font-bold">{block.headline}</h2>
                  {block.subheadline && <p className="mt-2">{block.subheadline}</p>}
                  <a
                    href={block.ctaUrl}
                    className="mt-6 inline-block rounded-md bg-background px-6 py-3 font-medium text-foreground hover:bg-background/90"
                  >
                    {block.ctaLabel}
                  </a>
                </section>
              );
            case 'form':
              return (
                <section key={idx} className="rounded-lg border bg-card p-8">
                  {block.title && <h2 className="text-2xl font-bold">{block.title}</h2>}
                  {block.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{block.description}</p>
                  )}
                  <LandingPageSubscribeForm
                    landingPageId={page.id}
                    sequenceId={block.sequenceId ?? null}
                    submitLabel={block.submitLabel ?? '送信'}
                  />
                </section>
              );
            case 'rich_text':
              return (
                <section
                  key={idx}
                  className="prose prose-slate max-w-none"
                  // 管理者の入力のみ。XSS リスクは admin に閉じる前提。
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      <footer className="mt-16 border-t pt-8 text-center text-xs text-muted-foreground">
        <p>powered by Kizashi · {host}</p>
      </footer>
    </main>
  );
}
