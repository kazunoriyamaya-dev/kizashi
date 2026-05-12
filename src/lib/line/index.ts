/**
 * LINE 連携
 *
 * - LINE Login (顧客 SSO): F001
 * - LINE Messaging API (通知): Q016
 *
 * Phase 2 / Phase 13 で本格実装。
 */

export interface LineNotifyInput {
  toLineUserId: string;
  message: string;
}

export async function sendLineNotification(_input: LineNotifyInput): Promise<{
  ok: boolean;
  errorReason?: string;
}> {
  // Phase 13 で実装
  return { ok: false, errorReason: 'Not implemented (Phase 13)' };
}
