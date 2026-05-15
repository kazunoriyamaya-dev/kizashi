/**
 * SNS publish 共通入力型
 */
export type MarketingPostChannel =
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'line';

export interface SnsPublishParams {
  body: string;
  hashtags?: string[];
  assetUrls: string[];
}
