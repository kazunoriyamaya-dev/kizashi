/**
 * ブログ一覧 /blog
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildTrialCtaUrl } from '@/lib/marketing/landing-pages/render';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'ブログ | Kizashi',
  description: '小中学生向けパーソナルレッスン Kizashi のブログです',
};

export default async function BlogIndexPage() {
  const supabase = createSupabaseServerClient();
  const { data: posts } = await supabase
    .from('marketing_blog_posts')
    .select('id, slug, title, excerpt, tags, published_at, reading_minutes, author_display_name')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">ブログ</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            学習法・体験談・お知らせなどを発信しています。
          </p>
        </div>
        <a
          href={buildTrialCtaUrl({
            utm: { source: 'blog', medium: 'organic', campaign: 'index', content: 'header' },
          })}
          className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          無料体験レッスンを予約する
        </a>
      </header>

      {(!posts || posts.length === 0) && (
        <p className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          まだ公開記事がありません。
        </p>
      )}

      <ul className="space-y-6">
        {(posts ?? []).map((p) => (
          <li key={p.id} className="rounded-lg border bg-card p-6">
            <Link href={`/blog/${p.slug}`} className="block">
              <h2 className="text-xl font-semibold hover:underline">{p.title}</h2>
              {p.excerpt && (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {p.published_at && <span>{p.published_at.slice(0, 10)}</span>}
                {p.author_display_name && <span>by {p.author_display_name}</span>}
                {p.reading_minutes && <span>約 {p.reading_minutes} 分で読めます</span>}
                {p.tags && p.tags.length > 0 && (
                  <span className="text-primary">{p.tags.map((t) => `#${t}`).join(' ')}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
