/**
 * ブログ記事 /blog/[slug]
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { renderMarkdownToHtml } from '@/lib/marketing/blog/markdown';
import { buildTrialCtaUrl } from '@/lib/marketing/landing-pages/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { slug: string };
}

async function fetchPost(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('marketing_blog_posts')
    .select(
      'id, slug, title, excerpt, body_markdown, body_html, tags, published_at, reading_minutes, author_display_name, meta_title, meta_description, og_image_url, status',
    )
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await fetchPost(params.slug);
  if (!post) return { title: 'Not Found' };
  return {
    title: post.meta_title ?? `${post.title} | Kizashi ブログ`,
    description: post.meta_description ?? post.excerpt ?? undefined,
    openGraph: {
      title: post.meta_title ?? post.title,
      description: post.meta_description ?? post.excerpt ?? undefined,
      images: post.og_image_url ? [{ url: post.og_image_url }] : undefined,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await fetchPost(params.slug);
  if (!post) notFound();

  // body_html が無ければオンザフライで生成
  const html = post.body_html ?? renderMarkdownToHtml(post.body_markdown);

  // PV インクリメント
  try {
    // fn_increment_blog_view は SECURITY DEFINER + anon grant 済み
    const supabase = createSupabaseServerClient();
    await supabase.rpc('fn_increment_blog_view', { p_blog_id: post.id });
  } catch {
    // ignore
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/blog" className="hover:underline">
          ← ブログ一覧
        </Link>
      </nav>

      <article>
        <header className="mb-8">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {post.published_at && <span>{post.published_at.slice(0, 10)}</span>}
            {post.author_display_name && <span>by {post.author_display_name}</span>}
            {post.reading_minutes && <span>約 {post.reading_minutes} 分で読めます</span>}
            {post.tags && post.tags.length > 0 && (
              <span className="text-primary">{post.tags.map((t) => `#${t}`).join(' ')}</span>
            )}
          </div>
        </header>

        <div
          className="prose prose-slate prose-headings:font-bold prose-a:text-primary max-w-none"
          // 本文 HTML は admin が登録した Markdown を renderMarkdownToHtml でエスケープ済み。
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      {/* 体験予約 CTA: ブログから新規生徒への導線 */}
      <aside className="mt-16 rounded-lg border-2 border-primary bg-primary/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Kizashi で実際に体験してみませんか？</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          小中学生向けのパーソナルレッスンを、無料体験から始められます。
        </p>
        <a
          href={buildTrialCtaUrl({
            utm: {
              source: 'blog',
              medium: 'organic',
              campaign: post.slug,
              content: 'article-footer',
            },
          })}
          className="mt-6 inline-block rounded-md bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
        >
          無料体験レッスンを予約する
        </a>
      </aside>

      <footer className="mt-16 border-t pt-8 text-center text-xs text-muted-foreground">
        <p>© Kizashi</p>
      </footer>
    </main>
  );
}
