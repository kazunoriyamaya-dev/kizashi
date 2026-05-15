'use server';

/**
 * /admin/marketing Server Actions
 *
 * 全 action は admin ロール必須。requireRole('admin') で再検証する。
 * Service Role を使用する書き込みは src/lib/supabase/admin.ts 経由。
 */
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { renderMarkdownToHtml, estimateReadingMinutes } from '@/lib/marketing/blog/markdown';
import { logger } from '@/lib/logger';

// ===== Campaign =====
const CampaignSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug は半角英数字とハイフンのみ'),
  description: z.string().max(2000).optional().nullable(),
  objective: z.enum(['awareness', 'traffic', 'lead', 'conversion', 'retention']),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  budget_jpy: z.coerce.number().int().min(0).default(0),
});

export async function createCampaign(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = CampaignSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') ?? null,
    objective: formData.get('objective') ?? 'awareness',
    start_at: formData.get('start_at') || null,
    end_at: formData.get('end_at') || null,
    budget_jpy: formData.get('budget_jpy') ?? 0,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_campaigns').insert({
    ...parsed,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/campaigns');
}

// ===== Asset =====
const AssetSchema = z.object({
  title: z.string().min(1).max(160),
  kind: z.enum(['image', 'banner', 'video', 'document']),
  storage_path: z.string().min(1),
  public_url: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  tags: z.string().optional().nullable(),
  ai_prompt: z.string().optional().nullable(),
  ai_provider: z.string().optional().nullable(),
});

export async function createAsset(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = AssetSchema.parse({
    title: formData.get('title'),
    kind: formData.get('kind') ?? 'image',
    storage_path: formData.get('storage_path'),
    public_url: formData.get('public_url') || null,
    description: formData.get('description') ?? null,
    tags: formData.get('tags') ?? null,
    ai_prompt: formData.get('ai_prompt') ?? null,
    ai_provider: formData.get('ai_provider') ?? null,
  });

  const tags = parsed.tags
    ? parsed.tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    : [];

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_assets').insert({
    title: parsed.title,
    kind: parsed.kind,
    storage_path: parsed.storage_path,
    public_url: parsed.public_url ?? null,
    description: parsed.description ?? null,
    tags,
    ai_prompt: parsed.ai_prompt ?? null,
    ai_provider: parsed.ai_provider ?? null,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/assets');
}

// ===== SNS Post =====
const SnsPostSchema = z.object({
  channel: z.enum(['twitter', 'instagram', 'facebook', 'tiktok', 'youtube', 'line']),
  body: z.string().min(1).max(4000),
  hashtags: z.string().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled']).default('draft'),
});

export async function createSnsPost(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = SnsPostSchema.parse({
    channel: formData.get('channel'),
    body: formData.get('body'),
    hashtags: formData.get('hashtags') ?? null,
    scheduled_at: formData.get('scheduled_at') || null,
    status: formData.get('status') ?? 'draft',
  });

  const hashtags = parsed.hashtags
    ? parsed.hashtags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter((t) => t.length > 0)
    : [];

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_sns_posts').insert({
    channel: parsed.channel,
    body: parsed.body,
    hashtags,
    scheduled_at: parsed.scheduled_at ?? null,
    status: parsed.status,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/sns');
}

// ===== LINE Broadcast =====
const LineBroadcastSchema = z.object({
  title: z.string().min(1).max(160),
  target_type: z.enum(['all', 'segment', 'tag']),
  target_tag: z.string().optional().nullable(),
  body: z.string().min(1).max(5000),
  scheduled_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled']).default('draft'),
});

export async function createLineBroadcast(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = LineBroadcastSchema.parse({
    title: formData.get('title'),
    target_type: formData.get('target_type') ?? 'all',
    target_tag: formData.get('target_tag') ?? null,
    body: formData.get('body'),
    scheduled_at: formData.get('scheduled_at') || null,
    status: formData.get('status') ?? 'draft',
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_line_broadcasts').insert({
    title: parsed.title,
    target_type: parsed.target_type,
    target_tag: parsed.target_tag ?? null,
    messages: [{ type: 'text', text: parsed.body }],
    scheduled_at: parsed.scheduled_at ?? null,
    status: parsed.status,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/line-broadcasts');
}

// ===== Email Sequence + Steps =====
const SequenceSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  trigger: z.enum(['subscription', 'tag_added', 'event', 'manual']),
  trigger_tag: z.string().optional().nullable(),
  from_name: z.string().min(1).max(80),
  from_email: z.string().email(),
  reply_to: z.string().email().optional().or(z.literal('')).nullable(),
});

export async function createSequence(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = SequenceSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') ?? null,
    trigger: formData.get('trigger') ?? 'subscription',
    trigger_tag: formData.get('trigger_tag') ?? null,
    from_name: formData.get('from_name') ?? 'Kizashi',
    from_email: formData.get('from_email'),
    reply_to: formData.get('reply_to') ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_email_sequences').insert({
    name: parsed.name,
    description: parsed.description ?? null,
    trigger: parsed.trigger,
    trigger_tag: parsed.trigger_tag ?? null,
    from_name: parsed.from_name,
    from_email: parsed.from_email,
    reply_to: parsed.reply_to || null,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/sequences');
}

const StepSchema = z.object({
  sequence_id: z.string().uuid(),
  step_order: z.coerce.number().int().min(0),
  delay_minutes: z.coerce.number().int().min(0),
  subject: z.string().min(1).max(200),
  body_text: z.string().min(1),
  cta_url: z.string().url().optional().or(z.literal('')).nullable(),
});

export async function createSequenceStep(formData: FormData) {
  await requireRole('admin');
  const parsed = StepSchema.parse({
    sequence_id: formData.get('sequence_id'),
    step_order: formData.get('step_order') ?? 0,
    delay_minutes: formData.get('delay_minutes') ?? 0,
    subject: formData.get('subject'),
    body_text: formData.get('body_text'),
    cta_url: formData.get('cta_url') ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_email_sequence_steps').insert({
    sequence_id: parsed.sequence_id,
    step_order: parsed.step_order,
    delay_minutes: parsed.delay_minutes,
    subject: parsed.subject,
    body_text: parsed.body_text,
    cta_url: parsed.cta_url || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/marketing/sequences/${parsed.sequence_id}`);
}

// ===== Landing Page =====
const LandingPageSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug は半角英数字とハイフンのみ'),
  title: z.string().min(1).max(160),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(400).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  publish_at: z.string().optional().nullable(),
  unpublish_at: z.string().optional().nullable(),
  cta_label: z.string().max(80).optional().nullable(),
  cta_url: z.string().url().optional().or(z.literal('')).nullable(),
  body_html: z.string().optional().nullable(),
  sequence_id: z.string().uuid().optional().or(z.literal('')).nullable(),
  trial_cta_headline: z.string().max(200).optional().nullable(),
  trial_cta_description: z.string().max(400).optional().nullable(),
  trial_cta_bullets: z.string().optional().nullable(),
});

export async function createLandingPage(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = LandingPageSchema.parse({
    slug: formData.get('slug'),
    title: formData.get('title'),
    headline: formData.get('headline'),
    subheadline: formData.get('subheadline') ?? null,
    status: formData.get('status') ?? 'draft',
    publish_at: formData.get('publish_at') || null,
    unpublish_at: formData.get('unpublish_at') || null,
    cta_label: formData.get('cta_label') ?? null,
    cta_url: formData.get('cta_url') ?? null,
    body_html: formData.get('body_html') ?? null,
    sequence_id: formData.get('sequence_id') ?? null,
    trial_cta_headline: formData.get('trial_cta_headline') ?? null,
    trial_cta_description: formData.get('trial_cta_description') ?? null,
    trial_cta_bullets: formData.get('trial_cta_bullets') ?? null,
  });

  const blocks = [
    {
      kind: 'hero' as const,
      headline: parsed.headline,
      subheadline: parsed.subheadline ?? undefined,
      ctaLabel: parsed.cta_label ?? undefined,
      ctaUrl: parsed.cta_url || undefined,
    },
  ];
  if (parsed.body_html) {
    blocks.push({ kind: 'rich_text', html: parsed.body_html } as never);
  }
  if (parsed.sequence_id) {
    blocks.push({
      kind: 'form',
      title: 'メールマガジン購読',
      sequenceId: parsed.sequence_id,
      submitLabel: 'まずは資料を受け取る',
    } as never);
  }
  // 体験予約 CTA は新規顧客獲得のため常に追加 (生徒数増加が目的)
  const bullets = parsed.trial_cta_bullets
    ? parsed.trial_cta_bullets
        .split(/[\n,]/)
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
    : [
        'お子様 1 人につき 1 回まで無料',
        '実際の講師との相性をその場で確認できます',
        '勧誘は一切ありません',
      ];
  blocks.push({
    kind: 'trial_cta',
    headline: parsed.trial_cta_headline ?? 'まずは無料体験レッスンから',
    description:
      parsed.trial_cta_description ??
      'Kizashi の講師と実際にレッスンを体験して、お子様に合う先生を見つけてください。',
    bullets,
  } as never);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_landing_pages').insert({
    slug: parsed.slug,
    title: parsed.title,
    headline: parsed.headline,
    subheadline: parsed.subheadline ?? null,
    status: parsed.status,
    publish_at: parsed.publish_at ?? null,
    unpublish_at: parsed.unpublish_at ?? null,
    sequence_id: parsed.sequence_id || null,
    blocks,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/landing-pages');
}

// ===== Blog Post =====
const BlogPostSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug は半角英数字とハイフンのみ'),
  title: z.string().min(1).max(160),
  excerpt: z.string().max(400).optional().nullable(),
  body_markdown: z.string().min(1),
  tags: z.string().optional().nullable(),
  meta_description: z.string().max(300).optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'),
  publish_at: z.string().optional().nullable(),
  author_display_name: z.string().max(80).optional().nullable(),
  ai_prompt: z.string().optional().nullable(),
  ai_model: z.string().optional().nullable(),
});

export async function createBlogPost(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = BlogPostSchema.parse({
    slug: formData.get('slug'),
    title: formData.get('title'),
    excerpt: formData.get('excerpt') ?? null,
    body_markdown: formData.get('body_markdown'),
    tags: formData.get('tags') ?? null,
    meta_description: formData.get('meta_description') ?? null,
    status: formData.get('status') ?? 'draft',
    publish_at: formData.get('publish_at') || null,
    author_display_name: formData.get('author_display_name') ?? null,
    ai_prompt: formData.get('ai_prompt') ?? null,
    ai_model: formData.get('ai_model') ?? null,
  });

  const tags = parsed.tags
    ? parsed.tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
    : [];

  const html = renderMarkdownToHtml(parsed.body_markdown);
  const readingMinutes = estimateReadingMinutes(parsed.body_markdown);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_blog_posts').insert({
    slug: parsed.slug,
    title: parsed.title,
    excerpt: parsed.excerpt ?? null,
    body_markdown: parsed.body_markdown,
    body_html: html,
    tags,
    meta_description: parsed.meta_description ?? null,
    status: parsed.status,
    publish_at: parsed.publish_at ?? null,
    published_at: parsed.status === 'published' ? new Date().toISOString() : null,
    reading_minutes: readingMinutes,
    author_profile_id: user.userId,
    author_display_name: parsed.author_display_name ?? user.displayName,
    ai_prompt: parsed.ai_prompt ?? null,
    ai_model: parsed.ai_model ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/blog');
}

// ===== Affiliate Link =====
const AffiliateLinkSchema = z.object({
  program_id: z.string().uuid().optional().or(z.literal('')).nullable(),
  target_url: z.string().url(),
  label: z.string().max(160).optional().nullable(),
  utm_source: z.string().max(80).optional().nullable(),
  utm_medium: z.string().max(80).optional().nullable(),
  utm_campaign: z.string().max(80).optional().nullable(),
  utm_content: z.string().max(80).optional().nullable(),
});

export async function createAffiliateLink(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = AffiliateLinkSchema.parse({
    program_id: formData.get('program_id') ?? null,
    target_url: formData.get('target_url'),
    label: formData.get('label') ?? null,
    utm_source: formData.get('utm_source') ?? null,
    utm_medium: formData.get('utm_medium') ?? null,
    utm_campaign: formData.get('utm_campaign') ?? null,
    utm_content: formData.get('utm_content') ?? null,
  });

  const code = crypto.randomBytes(5).toString('base64url');
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_affiliate_links').insert({
    program_id: parsed.program_id || null,
    target_url: parsed.target_url,
    code,
    label: parsed.label ?? null,
    utm_source: parsed.utm_source ?? null,
    utm_medium: parsed.utm_medium ?? null,
    utm_campaign: parsed.utm_campaign ?? null,
    utm_content: parsed.utm_content ?? null,
    created_by: user.userId,
  });
  if (error) {
    logger.error('createAffiliateLink failed', { code: error.code });
    throw new Error(error.message);
  }
  revalidatePath('/admin/marketing/affiliate');
}

const AffiliateProgramSchema = z.object({
  name: z.string().min(1).max(160),
  network: z.string().min(1).max(80),
  program_id: z.string().max(120).optional().nullable(),
  base_url: z.string().url(),
  default_commission_jpy: z.coerce.number().int().min(0).optional().nullable(),
  default_commission_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createAffiliateProgram(formData: FormData) {
  await requireRole('admin');
  const parsed = AffiliateProgramSchema.parse({
    name: formData.get('name'),
    network: formData.get('network'),
    program_id: formData.get('program_id') ?? null,
    base_url: formData.get('base_url'),
    default_commission_jpy: formData.get('default_commission_jpy') ?? null,
    default_commission_rate: formData.get('default_commission_rate') ?? null,
    notes: formData.get('notes') ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_affiliate_programs').insert({
    name: parsed.name,
    network: parsed.network,
    program_id: parsed.program_id ?? null,
    base_url: parsed.base_url,
    default_commission_jpy: parsed.default_commission_jpy ?? null,
    default_commission_rate: parsed.default_commission_rate ?? null,
    notes: parsed.notes ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/affiliate');
}

// ===== Ad Campaign =====
const AdCampaignSchema = z.object({
  name: z.string().min(1).max(160),
  platform: z.enum(['meta', 'google', 'tiktok', 'yahoo', 'line_ads', 'other']),
  external_id: z.string().max(120).optional().nullable(),
  daily_budget_jpy: z.coerce.number().int().min(0).default(0),
  total_budget_jpy: z.coerce.number().int().min(0).default(0),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).default('draft'),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createAdCampaign(formData: FormData) {
  const user = await requireRole('admin');
  const parsed = AdCampaignSchema.parse({
    name: formData.get('name'),
    platform: formData.get('platform'),
    external_id: formData.get('external_id') ?? null,
    daily_budget_jpy: formData.get('daily_budget_jpy') ?? 0,
    total_budget_jpy: formData.get('total_budget_jpy') ?? 0,
    status: formData.get('status') ?? 'draft',
    start_at: formData.get('start_at') || null,
    end_at: formData.get('end_at') || null,
    notes: formData.get('notes') ?? null,
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('marketing_ad_campaigns').insert({
    name: parsed.name,
    platform: parsed.platform,
    external_id: parsed.external_id ?? null,
    daily_budget_jpy: parsed.daily_budget_jpy,
    total_budget_jpy: parsed.total_budget_jpy,
    status: parsed.status,
    start_at: parsed.start_at ?? null,
    end_at: parsed.end_at ?? null,
    notes: parsed.notes ?? null,
    created_by: user.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/marketing/ads');
}
