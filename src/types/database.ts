/**
 * Supabase Database 型定義（Phase 1 手書き版）
 *
 * 本ファイルはマイグレーション適用後に
 *   pnpm gen:types
 * で自動上書き可能。形式は supabase gen types の出力と互換にしている。
 *
 * 設計書: 04_DB_RLS設計
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// =====================================================
// Enum 型
// =====================================================
export type Role = 'admin' | 'instructor' | 'customer';
export type ProfileStatus = 'invited' | 'active' | 'suspended' | 'deleted';
export type Category = 'learning' | 'sports' | 'art';
export type InstructorRank = 'gold' | 'silver' | 'bronze' | 'regular';
export type TransportationMode = 'train' | 'car';
export type LessonFormat = 'solo' | 'pair';
export type DeliveryType = 'online' | 'onsite';
export type ReservationType = 'normal' | 'trial';
export type ReservationStatus =
  | 'draft'
  | 'pending_payment'
  | 'confirmed'
  | 'changed'
  | 'cancelled'
  | 'completed'
  | 'no_show';
export type TicketStatus = 'active' | 'inactive' | 'deleted';
export type CustomerTicketStatus = 'active' | 'expired' | 'used' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type AddressOwnerType = 'customer' | 'instructor' | 'reservation_location';
export type MessageThreadType = 'admin_customer' | 'instructor_customer' | 'admin_instructor';
export type PayoutStatus = 'draft' | 'confirmed' | 'paid' | 'cancelled';
export type NotificationChannel = 'email' | 'line' | 'push';
export type NotificationStatus = 'queued' | 'sent' | 'failed';
export type TrialReviewStatus = 'pending' | 'approved' | 'rejected';
export type PairParticipantType = 'child' | 'free_text';
export type CancelReason = 'customer' | 'company' | 'instructor';

// =====================================================
// 各テーブルの Row / Insert / Update 型
// =====================================================

interface ProfilesRow {
  id: string;
  role: Role;
  email: string;
  display_name: string;
  phone: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

interface AddressesRow {
  id: string;
  owner_type: AddressOwnerType;
  owner_id: string;
  label: string | null;
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string;
  building: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  created_at: string;
  updated_at: string;
}

interface CustomersRow {
  id: string;
  profile_id: string;
  parent_name: string;
  parent_kana: string | null;
  line_user_id: string | null;
  google_sub: string | null;
  primary_address_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChildrenRow {
  id: string;
  customer_id: string;
  name: string;
  kana: string;
  birth_date: string;
  trial_used: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface InstructorsRow {
  id: string;
  profile_id: string;
  real_name: string;
  real_name_kana: string;
  nickname: string;
  avatar_url: string | null;
  public_bio: string | null;
  categories: Category[];
  genres: string[];
  transportation_mode: TransportationMode;
  base_address_id: string | null;
  rank: InstructorRank;
  priority: number;
  status: ProfileStatus;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface CalendarConnectionsRow {
  id: string;
  instructor_id: string;
  google_account_email: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  scope: string | null;
  last_synced_at: string | null;
  sync_failures: number;
  created_at: string;
  updated_at: string;
}

interface StripeConnectAccountsRow {
  id: string;
  instructor_id: string;
  stripe_account_id: string;
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: Json | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceSettingsRow {
  id: string;
  instructor_id: string;
  invoice_registration_no: string | null;
  registered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketsRow {
  id: string;
  name: string;
  description: string | null;
  category: Category | null;
  price: number;
  session_count: number;
  valid_days: number;
  duration_min: number;
  lesson_format: LessonFormat;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  sort_order: number;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

interface CustomerTicketsRow {
  id: string;
  customer_id: string;
  ticket_id: string;
  payment_id: string | null;
  remaining_count: number;
  initial_count: number;
  purchased_at: string;
  expires_at: string;
  status: CustomerTicketStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentsRow {
  id: string;
  customer_id: string;
  ticket_id: string | null;
  stripe_session_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number;
  currency: string;
  stripe_fee: number | null;
  net_amount: number | null;
  status: PaymentStatus;
  metadata: Json;
  refunded_amount: number;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StripeWebhookEventsRow {
  id: string;
  event_id: string;
  event_type: string;
  livemode: boolean;
  api_version: string | null;
  received_at: string;
  processed_at: string | null;
  payload: Json;
  error_message: string | null;
}

interface CancelPoliciesRow {
  id: string;
  free_cancel_minutes_before_start: number;
  free_change_minutes_before_start: number;
  change_deadline_hours: number;
  cancel_deadline_hours: number;
  ticket_return_rule_in_deadline: string;
  ticket_return_rule_out_deadline: string;
  ticket_return_rule_company: string;
  ticket_return_rule_instructor: string;
  effective_from: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PairParticipant {
  type: PairParticipantType;
  child_id?: string;
  name?: string;
  note?: string;
}

interface ReservationsRow {
  id: string;
  customer_id: string;
  child_id: string;
  instructor_id: string | null;
  category: Category;
  reservation_type: ReservationType;
  start_at: string;
  end_at: string;
  duration_min: number;
  delivery_type: DeliveryType;
  location_address_id: string | null;
  pair_participants: PairParticipant[];
  customer_ticket_id: string | null;
  designation_fee: number;
  status: ReservationStatus;
  google_event_id: string | null;
  google_meet_url: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: CancelReason | null;
  cancel_note: string | null;
  created_at: string;
  updated_at: string;
}

interface TravelFeesRow {
  id: string;
  reservation_id: string;
  mode: TransportationMode;
  one_way_distance_km: number | null;
  round_trip_distance_km: number | null;
  amount: number;
  is_manual: boolean;
  manual_reason: string | null;
  requires_admin_review: boolean;
  maps_response_summary: Json | null;
  created_at: string;
  updated_at: string;
}

interface ReservationChangesRow {
  id: string;
  reservation_id: string;
  actor_profile_id: string | null;
  change_type: string;
  before_data: Json | null;
  after_data: Json | null;
  note: string | null;
  created_at: string;
}

interface TrialPendingReviewsRow {
  id: string;
  customer_id: string;
  child_id: string;
  matched_child_id: string | null;
  requested_at: string;
  requested_payload: Json;
  status: TrialReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  resulting_reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GoogleMeetLinksRow {
  id: string;
  reservation_id: string;
  meet_url: string;
  google_event_id: string | null;
  issued_at: string;
  revoked_at: string | null;
  created_at: string;
}

interface MessageThreadsRow {
  id: string;
  thread_type: MessageThreadType;
  customer_id: string | null;
  instructor_id: string | null;
  last_message_at: string | null;
  seed_reservation_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MessagesRow {
  id: string;
  thread_id: string;
  sender_profile_id: string;
  body: string;
  read_at_by_admin: string | null;
  read_at_by_other: string | null;
  created_at: string;
}

interface PayoutsRow {
  id: string;
  instructor_id: string;
  period_month: string;
  gross_amount: number;
  stripe_fee_amount: number;
  designation_fee_amount: number;
  travel_fee_amount: number;
  instructor_amount: number;
  detail: Json;
  status: PayoutStatus;
  confirmed_at: string | null;
  paid_at: string | null;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  invoice_registration_no: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditLogsRow {
  id: string;
  actor_profile_id: string | null;
  actor_role: Role | null;
  action: string;
  target_table: string;
  target_id: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip_hash: string | null;
  user_agent: string | null;
  note: string | null;
  created_at: string;
}

interface EmailNotificationLogsRow {
  id: string;
  target_profile_id: string | null;
  to_email: string;
  template: string;
  subject: string;
  payload: Json;
  status: NotificationStatus;
  provider: string;
  provider_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface LineNotificationLogsRow {
  id: string;
  target_profile_id: string | null;
  to_line_user_id: string;
  template: string;
  payload: Json;
  status: NotificationStatus;
  provider_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface PushSubscriptionsRow {
  id: string;
  profile_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface PushNotificationLogsRow {
  id: string;
  subscription_id: string | null;
  target_profile_id: string | null;
  template: string;
  title: string;
  body: string;
  payload: Json;
  status: NotificationStatus;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface SystemSettingsRow {
  id: string;
  instructor_designation_fees: Json;
  ticket_expiry_notify_days: number[];
  reservation_window_days: number;
  reservation_open_hour: number;
  reservation_close_hour: number;
  onsite_buffer_minutes: number;
  online_buffer_minutes: number;
  car_fare_per_km: number;
  trial_duplicate_action: string;
  message_audit_disclosed: boolean;
  invite_token_ttl_hours: number;
  extras: Json;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
// 公開ビュー
// =====================================================
interface InstructorsPublicRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
  public_bio: string | null;
  categories: Category[];
  genres: string[];
  rank: InstructorRank;
  status: ProfileStatus;
}

// =====================================================
// マーケティング自動化 (Phase 15)
// =====================================================
export type MarketingAssetKind = 'image' | 'banner' | 'video' | 'document';
export type MarketingPostChannel =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'line';
export type MarketingPostStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'published'
  | 'failed'
  | 'archived';
export type MarketingSequenceTrigger = 'subscription' | 'tag_added' | 'event' | 'manual';
export type MarketingEmailStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'unsubscribed';
export type MarketingSubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained';
export type MarketingLpStatus = 'draft' | 'published' | 'archived';
export type MarketingBlogStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type MarketingLineTarget = 'all' | 'segment' | 'tag';
export type MarketingAdPlatform = 'meta' | 'google' | 'tiktok' | 'yahoo' | 'line_ads' | 'other';
export type MarketingAdStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type MarketingCampaignObjective =
  | 'awareness'
  | 'traffic'
  | 'lead'
  | 'conversion'
  | 'retention';

interface MarketingCampaignsRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  objective: MarketingCampaignObjective;
  start_at: string | null;
  end_at: string | null;
  budget_jpy: number;
  target_audience: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingAssetsRow {
  id: string;
  campaign_id: string | null;
  kind: MarketingAssetKind;
  title: string;
  description: string | null;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
  duration_sec: number | null;
  file_size_bytes: number | null;
  tags: string[];
  ai_prompt: string | null;
  ai_provider: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingSnsPostsRow {
  id: string;
  campaign_id: string | null;
  channel: MarketingPostChannel;
  body: string;
  asset_ids: string[];
  hashtags: string[];
  scheduled_at: string | null;
  published_at: string | null;
  status: MarketingPostStatus;
  external_post_id: string | null;
  error_message: string | null;
  metrics: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingLineSegmentsRow {
  id: string;
  name: string;
  description: string | null;
  filter: Json;
  estimated_size: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingLineBroadcastsRow {
  id: string;
  campaign_id: string | null;
  segment_id: string | null;
  title: string;
  target_type: MarketingLineTarget;
  target_tag: string | null;
  messages: Json;
  scheduled_at: string | null;
  sent_at: string | null;
  status: MarketingPostStatus;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingLineScenariosRow {
  id: string;
  name: string;
  trigger_keyword: string | null;
  trigger_event: string | null;
  steps: Json;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingEmailSequencesRow {
  id: string;
  campaign_id: string | null;
  name: string;
  description: string | null;
  trigger: MarketingSequenceTrigger;
  trigger_tag: string | null;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingEmailSequenceStepsRow {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_minutes: number;
  subject: string;
  body_text: string;
  body_html: string | null;
  cta_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MarketingEmailSubscribersRow {
  id: string;
  email: string;
  name: string | null;
  profile_id: string | null;
  source: string;
  landing_page_id: string | null;
  tags: string[];
  status: MarketingSubscriberStatus;
  consent_at: string;
  unsubscribed_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

interface MarketingEmailEnrollmentsRow {
  id: string;
  subscriber_id: string;
  sequence_id: string;
  next_step_order: number;
  next_send_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingEmailSendsRow {
  id: string;
  subscriber_id: string;
  sequence_id: string | null;
  step_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  status: MarketingEmailStatus;
  provider_id: string | null;
  error_message: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  created_at: string;
}

interface MarketingLandingPagesRow {
  id: string;
  campaign_id: string | null;
  sequence_id: string | null;
  slug: string;
  title: string;
  headline: string;
  subheadline: string | null;
  hero_asset_id: string | null;
  blocks: Json;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  status: MarketingLpStatus;
  publish_at: string | null;
  unpublish_at: string | null;
  view_count: number;
  conversion_count: number;
  template_key: string | null;
  ai_prompt: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingBlogCategoriesRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingBlogPostsRow {
  id: string;
  campaign_id: string | null;
  category_id: string | null;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  body_html: string | null;
  hero_asset_id: string | null;
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  status: MarketingBlogStatus;
  publish_at: string | null;
  published_at: string | null;
  view_count: number;
  reading_minutes: number | null;
  author_profile_id: string | null;
  author_display_name: string | null;
  ai_prompt: string | null;
  ai_model: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingAffiliateProgramsRow {
  id: string;
  name: string;
  network: string;
  program_id: string | null;
  base_url: string;
  default_commission_jpy: number | null;
  default_commission_rate: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MarketingAffiliateLinksRow {
  id: string;
  program_id: string | null;
  blog_post_id: string | null;
  campaign_id: string | null;
  code: string;
  target_url: string;
  label: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  is_active: boolean;
  click_count: number;
  conversion_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingAffiliateClicksRow {
  id: string;
  link_id: string;
  ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
  country: string | null;
  device: string | null;
  clicked_at: string;
}

interface MarketingAffiliateConversionsRow {
  id: string;
  link_id: string | null;
  program_id: string | null;
  external_order_id: string | null;
  commission_jpy: number;
  status: string;
  raw_payload: Json;
  converted_at: string;
  confirmed_at: string | null;
}

interface MarketingAdCampaignsRow {
  id: string;
  campaign_id: string | null;
  landing_page_id: string | null;
  platform: MarketingAdPlatform;
  external_id: string | null;
  name: string;
  objective: string | null;
  daily_budget_jpy: number;
  total_budget_jpy: number;
  status: MarketingAdStatus;
  start_at: string | null;
  end_at: string | null;
  target_audience: Json;
  creative_asset_ids: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingAdMetricsDailyRow {
  id: string;
  ad_campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend_jpy: number;
  revenue_jpy: number;
  raw_payload: Json;
  fetched_at: string;
}

interface MarketingAttributionRow {
  id: string;
  subscriber_id: string | null;
  email: string;
  lead_source_kind: string;
  landing_page_id: string | null;
  blog_post_id: string | null;
  sns_post_id: string | null;
  affiliate_link_id: string | null;
  ad_campaign_id: string | null;
  campaign_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  referrer: string | null;
  lead_at: string;
  profile_id: string | null;
  profile_linked_at: string | null;
  trial_reserved_at: string | null;
  trial_completed_at: string | null;
  first_paid_at: string | null;
  first_payment_jpy: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MarketingAnalyticsEventsRow {
  id: string;
  event_name: string;
  campaign_id: string | null;
  landing_page_id: string | null;
  blog_post_id: string | null;
  sns_post_id: string | null;
  affiliate_link_id: string | null;
  subscriber_id: string | null;
  profile_id: string | null;
  session_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  properties: Json;
  created_at: string;
}

// =====================================================
// Database 型エクスポート
// =====================================================
type WithBase<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: WithBase<ProfilesRow>;
      addresses: WithBase<AddressesRow>;
      customers: WithBase<CustomersRow>;
      children: WithBase<ChildrenRow>;
      instructors: WithBase<InstructorsRow>;
      calendar_connections: WithBase<CalendarConnectionsRow>;
      stripe_connect_accounts: WithBase<StripeConnectAccountsRow>;
      invoice_settings: WithBase<InvoiceSettingsRow>;
      tickets: WithBase<TicketsRow>;
      customer_tickets: WithBase<CustomerTicketsRow>;
      payments: WithBase<PaymentsRow>;
      stripe_webhook_events: WithBase<StripeWebhookEventsRow>;
      cancel_policies: WithBase<CancelPoliciesRow>;
      reservations: WithBase<ReservationsRow>;
      travel_fees: WithBase<TravelFeesRow>;
      reservation_changes: WithBase<ReservationChangesRow>;
      trial_pending_reviews: WithBase<TrialPendingReviewsRow>;
      google_meet_links: WithBase<GoogleMeetLinksRow>;
      message_threads: WithBase<MessageThreadsRow>;
      messages: WithBase<MessagesRow>;
      payouts: WithBase<PayoutsRow>;
      audit_logs: WithBase<AuditLogsRow>;
      email_notification_logs: WithBase<EmailNotificationLogsRow>;
      line_notification_logs: WithBase<LineNotificationLogsRow>;
      push_subscriptions: WithBase<PushSubscriptionsRow>;
      push_notification_logs: WithBase<PushNotificationLogsRow>;
      system_settings: WithBase<SystemSettingsRow>;
      marketing_campaigns: WithBase<MarketingCampaignsRow>;
      marketing_assets: WithBase<MarketingAssetsRow>;
      marketing_sns_posts: WithBase<MarketingSnsPostsRow>;
      marketing_line_segments: WithBase<MarketingLineSegmentsRow>;
      marketing_line_broadcasts: WithBase<MarketingLineBroadcastsRow>;
      marketing_line_scenarios: WithBase<MarketingLineScenariosRow>;
      marketing_email_sequences: WithBase<MarketingEmailSequencesRow>;
      marketing_email_sequence_steps: WithBase<MarketingEmailSequenceStepsRow>;
      marketing_email_subscribers: WithBase<MarketingEmailSubscribersRow>;
      marketing_email_enrollments: WithBase<MarketingEmailEnrollmentsRow>;
      marketing_email_sends: WithBase<MarketingEmailSendsRow>;
      marketing_landing_pages: WithBase<MarketingLandingPagesRow>;
      marketing_blog_categories: WithBase<MarketingBlogCategoriesRow>;
      marketing_blog_posts: WithBase<MarketingBlogPostsRow>;
      marketing_affiliate_programs: WithBase<MarketingAffiliateProgramsRow>;
      marketing_affiliate_links: WithBase<MarketingAffiliateLinksRow>;
      marketing_affiliate_clicks: WithBase<MarketingAffiliateClicksRow>;
      marketing_affiliate_conversions: WithBase<MarketingAffiliateConversionsRow>;
      marketing_ad_campaigns: WithBase<MarketingAdCampaignsRow>;
      marketing_ad_metrics_daily: WithBase<MarketingAdMetricsDailyRow>;
      marketing_analytics_events: WithBase<MarketingAnalyticsEventsRow>;
      marketing_attribution: WithBase<MarketingAttributionRow>;
    };
    Views: {
      instructors_public: {
        Row: InstructorsPublicRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: {
      fn_current_role: { Args: Record<string, never>; Returns: Role };
      fn_is_admin: { Args: Record<string, never>; Returns: boolean };
      fn_is_instructor: { Args: Record<string, never>; Returns: boolean };
      fn_is_customer: { Args: Record<string, never>; Returns: boolean };
      fn_current_customer_id: { Args: Record<string, never>; Returns: string | null };
      fn_current_instructor_id: { Args: Record<string, never>; Returns: string | null };
      fn_sweep_expired_tickets: { Args: Record<string, never>; Returns: { updated_count: number }[] };
      fn_close_used_tickets: { Args: Record<string, never>; Returns: void };
      fn_find_trial_duplicates: {
        Args: { p_name: string; p_kana: string; p_birth_date: string };
        Returns: { child_id: string; customer_id: string; trial_used: boolean }[];
      };
      fn_create_normal_reservation: {
        Args: {
          p_customer_id: string;
          p_child_id: string;
          p_instructor_id: string;
          p_category: Category;
          p_start_at: string;
          p_end_at: string;
          p_duration_min: number;
          p_delivery_type: DeliveryType;
          p_location_address_id: string | null;
          p_customer_ticket_id: string;
          p_pair_participants?: Json;
        };
        Returns: {
          reservation_id: string;
          designation_fee: number;
          ticket_status: CustomerTicketStatus;
          remaining_count: number;
        }[];
      };
      fn_attach_calendar_event: {
        Args: { p_reservation_id: string; p_event_id: string; p_meet_url?: string | null };
        Returns: void;
      };
      fn_grant_customer_ticket: {
        Args: {
          p_customer_id: string;
          p_ticket_id: string;
          p_stripe_session_id: string;
          p_stripe_pi_id: string;
          p_amount: number;
          p_currency?: string;
          p_metadata?: Json;
        };
        Returns: {
          payment_id: string;
          customer_ticket_id: string;
          already_processed: boolean;
        }[];
      };
      fn_apply_payment_fee: {
        Args: {
          p_payment_id: string;
          p_stripe_charge_id: string;
          p_stripe_fee: number;
          p_net_amount: number;
        };
        Returns: void;
      };
      fn_create_trial_reservation: {
        Args: {
          p_customer_id: string;
          p_child_id: string;
          p_instructor_id: string;
          p_category: Category;
          p_start_at: string;
          p_end_at: string;
          p_duration_min: number;
          p_delivery_type: DeliveryType;
        };
        Returns: { reservation_id: string; designation_fee: number }[];
      };
      fn_register_trial_pending: {
        Args: {
          p_customer_id: string;
          p_child_id: string;
          p_matched_child_id: string | null;
          p_requested_payload: Json;
        };
        Returns: { review_id: string }[];
      };
      fn_cancel_reservation: {
        Args: {
          p_reservation_id: string;
          p_actor_profile_id: string;
          p_actor_role: Role;
          p_cancel_reason: CancelReason;
          p_ticket_return_rule: 'full_return' | 'half_refund_fee' | 'no_return';
          p_cancel_note?: string | null;
        };
        Returns: {
          reservation_id: string;
          ticket_returned: boolean;
          refund_amount: number;
        }[];
      };
      fn_change_reservation: {
        Args: {
          p_reservation_id: string;
          p_actor_profile_id: string;
          p_actor_role: Role;
          p_new_start_at: string;
          p_new_end_at: string;
          p_new_delivery_type?: DeliveryType | null;
          p_new_location_address_id?: string | null;
        };
        Returns: { reservation_id: string }[];
      };
      fn_compute_monthly_payouts: {
        Args: { p_period_month: string; p_recompute?: boolean };
        Returns: {
          instructor_id: string;
          payout_id: string;
          instructor_amount: number;
          status: PayoutStatus;
        }[];
      };
      fn_confirm_payout: {
        Args: { p_payout_id: string; p_actor_profile_id: string };
        Returns: void;
      };
      fn_mark_payout_paid: {
        Args: {
          p_payout_id: string;
          p_actor_profile_id: string;
          p_stripe_transfer_id: string;
          p_stripe_payout_id?: string | null;
        };
        Returns: void;
      };
      fn_record_affiliate_click: {
        Args: {
          p_link_id: string;
          p_ip_hash: string | null;
          p_user_agent: string | null;
          p_referrer: string | null;
        };
        Returns: void;
      };
      fn_increment_landing_page_view: {
        Args: { p_lp_id: string };
        Returns: void;
      };
      fn_increment_blog_view: {
        Args: { p_blog_id: string };
        Returns: void;
      };
      fn_sync_marketing_attribution: {
        Args: Record<string, never>;
        Returns: {
          linked: number;
          trial_reserved: number;
          trial_completed: number;
          first_paid: number;
        }[];
      };
    };
    Enums: {
      role: Role;
      profile_status: ProfileStatus;
      category: Category;
      instructor_rank: InstructorRank;
      transportation_mode: TransportationMode;
      lesson_format: LessonFormat;
      delivery_type: DeliveryType;
      reservation_type: ReservationType;
      reservation_status: ReservationStatus;
      ticket_status: TicketStatus;
      customer_ticket_status: CustomerTicketStatus;
      payment_status: PaymentStatus;
      address_owner_type: AddressOwnerType;
      message_thread_type: MessageThreadType;
      payout_status: PayoutStatus;
      notification_channel: NotificationChannel;
      notification_status: NotificationStatus;
      trial_review_status: TrialReviewStatus;
      pair_participant_type: PairParticipantType;
      cancel_reason: CancelReason;
    };
    CompositeTypes: Record<string, never>;
  };
}

// 各テーブル Row 型のエクスポート
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];
