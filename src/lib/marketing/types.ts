/**
 * マーケ自動化システム 共通型
 *
 * DB 直結の型は @/types/database から派生させる。
 * blocks/messages など jsonb で保持するペイロード型はここで明示する。
 */
import type { Database } from '@/types/database';

export type MarketingCampaign = Database['public']['Tables']['marketing_campaigns']['Row'];
export type MarketingAsset = Database['public']['Tables']['marketing_assets']['Row'];
export type MarketingSnsPost = Database['public']['Tables']['marketing_sns_posts']['Row'];
export type MarketingLineSegment = Database['public']['Tables']['marketing_line_segments']['Row'];
export type MarketingLineBroadcast = Database['public']['Tables']['marketing_line_broadcasts']['Row'];
export type MarketingLineScenario = Database['public']['Tables']['marketing_line_scenarios']['Row'];
export type MarketingEmailSequence = Database['public']['Tables']['marketing_email_sequences']['Row'];
export type MarketingEmailSequenceStep =
  Database['public']['Tables']['marketing_email_sequence_steps']['Row'];
export type MarketingEmailSubscriber =
  Database['public']['Tables']['marketing_email_subscribers']['Row'];
export type MarketingEmailEnrollment =
  Database['public']['Tables']['marketing_email_enrollments']['Row'];
export type MarketingEmailSend = Database['public']['Tables']['marketing_email_sends']['Row'];
export type MarketingLandingPage = Database['public']['Tables']['marketing_landing_pages']['Row'];
export type MarketingBlogPost = Database['public']['Tables']['marketing_blog_posts']['Row'];
export type MarketingBlogCategory =
  Database['public']['Tables']['marketing_blog_categories']['Row'];
export type MarketingAffiliateProgram =
  Database['public']['Tables']['marketing_affiliate_programs']['Row'];
export type MarketingAffiliateLink =
  Database['public']['Tables']['marketing_affiliate_links']['Row'];
export type MarketingAdCampaign = Database['public']['Tables']['marketing_ad_campaigns']['Row'];
export type MarketingAdMetricDaily =
  Database['public']['Tables']['marketing_ad_metrics_daily']['Row'];

// =====================================================
// LP の blocks スキーマ
// =====================================================
export type LandingPageBlock =
  | { kind: 'hero'; headline: string; subheadline?: string; ctaLabel?: string; ctaUrl?: string; assetId?: string }
  | { kind: 'feature_list'; title?: string; items: Array<{ title: string; body: string; iconKey?: string }> }
  | { kind: 'testimonial'; items: Array<{ author: string; role?: string; body: string; assetId?: string }> }
  | { kind: 'faq'; items: Array<{ q: string; a: string }> }
  | { kind: 'cta'; headline: string; subheadline?: string; ctaLabel: string; ctaUrl: string }
  | { kind: 'form'; title?: string; description?: string; sequenceId?: string; submitLabel?: string }
  | { kind: 'rich_text'; html: string };

// =====================================================
// LINE メッセージ blocks スキーマ (Messaging API の Message Objects 簡易型)
// =====================================================
export type LineMessageObject =
  | { type: 'text'; text: string }
  | { type: 'image'; originalContentUrl: string; previewImageUrl: string }
  | { type: 'video'; originalContentUrl: string; previewImageUrl: string }
  | { type: 'sticker'; packageId: string; stickerId: string };

// =====================================================
// SNS 投稿パブリッシャー アダプタ I/F
// =====================================================
export interface SnsPublishResult {
  ok: boolean;
  externalPostId?: string;
  error?: string;
}
