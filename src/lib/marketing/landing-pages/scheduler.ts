/**
 * LP の自動公開/取り下げ
 *
 *  - publish_at <= now() で status='draft' or 'scheduled' のもの -> status='published'
 *  - unpublish_at <= now() で status='published' のもの -> status='archived'
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export async function publishDueLandingPages(): Promise<{ published: number; archived: number }> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  let published = 0;
  let archived = 0;

  const { data: due, error: dueErr } = await admin
    .from('marketing_landing_pages')
    .select('id')
    .eq('status', 'draft')
    .not('publish_at', 'is', null)
    .lte('publish_at', now);
  if (dueErr) {
    logger.error('publishDueLandingPages select error', { code: dueErr.code });
  } else if (due && due.length > 0) {
    const ids = due.map((d) => d.id);
    await admin.from('marketing_landing_pages').update({ status: 'published' }).in('id', ids);
    published = ids.length;
  }

  const { data: expire } = await admin
    .from('marketing_landing_pages')
    .select('id')
    .eq('status', 'published')
    .not('unpublish_at', 'is', null)
    .lte('unpublish_at', now);
  if (expire && expire.length > 0) {
    const ids = expire.map((d) => d.id);
    await admin.from('marketing_landing_pages').update({ status: 'archived' }).in('id', ids);
    archived = ids.length;
  }

  return { published, archived };
}
