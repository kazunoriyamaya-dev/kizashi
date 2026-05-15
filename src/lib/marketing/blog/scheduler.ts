/**
 * ブログの自動公開
 *
 * status='scheduled' && publish_at <= now() の記事を published に上げ、
 * body_markdown -> body_html を render しキャッシュする。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { renderMarkdownToHtml, estimateReadingMinutes } from '@/lib/marketing/blog/markdown';

export async function publishDueBlogPosts(): Promise<{ published: number }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from('marketing_blog_posts')
    .select('id, body_markdown')
    .eq('status', 'scheduled')
    .not('publish_at', 'is', null)
    .lte('publish_at', now);

  if (error) {
    logger.error('publishDueBlogPosts select error', { code: error.code });
    return { published: 0 };
  }
  if (!due || due.length === 0) return { published: 0 };

  let published = 0;
  for (const row of due) {
    const html = renderMarkdownToHtml(row.body_markdown);
    const minutes = estimateReadingMinutes(row.body_markdown);
    await admin
      .from('marketing_blog_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        body_html: html,
        reading_minutes: minutes,
      })
      .eq('id', row.id);
    published++;
  }
  return { published };
}
