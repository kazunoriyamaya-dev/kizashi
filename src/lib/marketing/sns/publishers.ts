/**
 * SNS 投稿 パブリッシャー アダプタ群
 *
 * 各プラットフォーム (twitter / instagram / facebook / tiktok / youtube / line) ごとの publish 関数を提供。
 * MVP 段階では実 API 連携はスタブとし、credential 未設定なら即座に { ok: false, error: 'credential_missing' } を返す。
 *
 * 本番運用時の TODO:
 *   - twitter: OAuth2 (PKCE) + POST /2/tweets
 *   - instagram / facebook: Meta Graph API /me/media + /me/media_publish
 *   - tiktok: Content Posting API (POST /v2/post/publish/inbox/video/init/)
 *   - youtube: YouTube Data API v3 videos.insert (resumable upload)
 *   - line: marketing_line_broadcasts 経由 (Messaging API /v2/bot/message/broadcast)
 */
import { logger } from '@/lib/logger';
import type { MarketingPostChannel, SnsPublishParams } from '@/lib/marketing/sns/types';
import type { SnsPublishResult } from '@/lib/marketing/types';

export type { MarketingPostChannel };

interface PublisherInput extends SnsPublishParams {
  channel: MarketingPostChannel;
}

export async function publishToChannel(input: PublisherInput): Promise<SnsPublishResult> {
  switch (input.channel) {
    case 'twitter':
      return publishToTwitter(input);
    case 'instagram':
      return publishToInstagram(input);
    case 'facebook':
      return publishToFacebook(input);
    case 'tiktok':
      return publishToTikTok(input);
    case 'youtube':
      return publishToYouTube(input);
    case 'line':
      // /admin/marketing/line-broadcasts 経由を推奨。SNS 投稿として扱う場合のみ通る。
      return { ok: false, error: 'use_line_broadcast_module' };
  }
}

async function publishToTwitter(input: PublisherInput): Promise<SnsPublishResult> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    logger.warn('TWITTER_BEARER_TOKEN 未設定。投稿をスキップ');
    return { ok: false, error: 'credential_missing' };
  }
  // 本実装: POST https://api.twitter.com/2/tweets { text }
  // text 長制限 280 文字。media_ids は別途 upload 必要。
  try {
    const res = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: composeBody(input).slice(0, 280) }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `${res.status}_${detail.slice(0, 100)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
    return { ok: true, externalPostId: json.data?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 100) : 'fetch_failed' };
  }
}

async function publishToInstagram(input: PublisherInput): Promise<SnsPublishResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const igUserId = process.env.META_IG_USER_ID;
  if (!token || !igUserId) {
    logger.warn('META_PAGE_ACCESS_TOKEN / META_IG_USER_ID 未設定。投稿をスキップ');
    return { ok: false, error: 'credential_missing' };
  }
  if (input.assetUrls.length === 0) {
    return { ok: false, error: 'instagram_requires_media' };
  }
  // 本実装は 2-step: media container 作成 → publish
  // ここでは 1 枚画像投稿のみ簡易対応。
  try {
    const createRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media?image_url=${encodeURIComponent(
        input.assetUrls[0]!,
      )}&caption=${encodeURIComponent(composeBody(input))}&access_token=${token}`,
      { method: 'POST' },
    );
    if (!createRes.ok) {
      return { ok: false, error: `create_${createRes.status}` };
    }
    const createJson = (await createRes.json()) as { id?: string };
    if (!createJson.id) return { ok: false, error: 'no_container_id' };

    const publishRes = await fetch(
      `https://graph.facebook.com/v18.0/${igUserId}/media_publish?creation_id=${createJson.id}&access_token=${token}`,
      { method: 'POST' },
    );
    if (!publishRes.ok) {
      return { ok: false, error: `publish_${publishRes.status}` };
    }
    const publishJson = (await publishRes.json()) as { id?: string };
    return { ok: true, externalPostId: publishJson.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 100) : 'fetch_failed' };
  }
}

async function publishToFacebook(input: PublisherInput): Promise<SnsPublishResult> {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) {
    logger.warn('META_PAGE_ACCESS_TOKEN / META_PAGE_ID 未設定。投稿をスキップ');
    return { ok: false, error: 'credential_missing' };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/feed?message=${encodeURIComponent(
        composeBody(input),
      )}&access_token=${token}`,
      { method: 'POST' },
    );
    if (!res.ok) return { ok: false, error: `${res.status}` };
    const json = (await res.json()) as { id?: string };
    return { ok: true, externalPostId: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 100) : 'fetch_failed' };
  }
}

async function publishToTikTok(_input: PublisherInput): Promise<SnsPublishResult> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) {
    logger.warn('TIKTOK_ACCESS_TOKEN 未設定。投稿をスキップ');
    return { ok: false, error: 'credential_missing' };
  }
  // TikTok Content Posting API は資料量が多いため stub
  return { ok: false, error: 'tiktok_not_implemented_yet' };
}

async function publishToYouTube(_input: PublisherInput): Promise<SnsPublishResult> {
  const token = process.env.YOUTUBE_ACCESS_TOKEN;
  if (!token) {
    logger.warn('YOUTUBE_ACCESS_TOKEN 未設定。投稿をスキップ');
    return { ok: false, error: 'credential_missing' };
  }
  // resumable upload の手間があるため stub
  return { ok: false, error: 'youtube_not_implemented_yet' };
}

function composeBody(input: PublisherInput): string {
  const tags = input.hashtags?.length ? '\n\n' + input.hashtags.map((h) => `#${h}`).join(' ') : '';
  return `${input.body}${tags}`;
}
