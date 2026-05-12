/**
 * 通知統合モジュール
 *
 * 通知チャネル: メール / LINE / Push (Q016)
 * MVPで全て実装。
 *
 * イベント: F039 + 周辺
 *  - 顧客新規登録
 *  - 講師アカウント発行依頼
 *  - 講師プロフィール登録完了
 *  - 予約確定 / 変更 / キャンセル
 *  - チケット購入完了
 *  - 体験予約完了
 *  - メッセージ受信
 *  - 講師支払い予定作成
 *  - 管理者向けエラー通知
 *  - チケット期限切れ予告 (Q022: 1ヶ月/2週間/1週間/1日前)
 *
 * Phase 13 で本格実装。
 */

export type NotificationEvent =
  | 'customer_signup'
  | 'instructor_invite'
  | 'instructor_activated'
  | 'reservation_confirmed'
  | 'reservation_changed'
  | 'reservation_cancelled'
  | 'ticket_purchased'
  | 'trial_reservation_completed'
  | 'message_received'
  | 'payout_drafted'
  | 'admin_error_alert'
  | 'ticket_expiring';

export interface NotificationTarget {
  profileId: string;
  channels: Array<'email' | 'line' | 'push'>;
}

export async function notify(
  _event: NotificationEvent,
  _target: NotificationTarget,
  _payload: Record<string, unknown>,
): Promise<void> {
  // Phase 13 で実装
}
