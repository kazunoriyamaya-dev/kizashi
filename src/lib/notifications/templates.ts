/**
 * 通知テンプレート
 *
 * 各チャネル (email/line/push) に対して、テンプレート名 + payload から
 * 件名・本文 (HTML/プレーン/タイトル) を生成する。
 *
 * 設計書 F039 + 各イベント:
 *  - reservation_confirmed
 *  - reservation_changed
 *  - reservation_cancelled_by_customer
 *  - reservation_cancelled_by_instructor (Q014)
 *  - reservation_cancelled_by_company
 *  - trial_reservation_confirmed
 *  - trial_pending_admin (Q003)
 *  - ticket_purchased
 *  - ticket_expiring (Q022: 30/14/7/1日前)
 *  - instructor_invite
 *  - message_received
 *  - payout_drafted
 *
 * payload はテンプレート毎に必要なフィールドが異なる
 */

export interface NotificationTemplateContent {
  subject: string;
  text: string;
  html: string;
  /** Push 通知用の短い title */
  pushTitle: string;
  /** Push 通知用の短い body */
  pushBody: string;
  /** LINE 通知用の短い text (5000文字制限内) */
  lineText: string;
  /** 関連URL (Push の click_action や LINE のボタン用) */
  url?: string;
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
): NotificationTemplateContent {
  switch (template) {
    case 'reservation_confirmed':
      return reservationConfirmed(payload);
    case 'reservation_changed':
      return reservationChanged(payload);
    case 'reservation_cancelled_by_customer':
      return reservationCancelled('customer', payload);
    case 'reservation_cancelled_by_instructor':
      return reservationCancelled('instructor', payload);
    case 'reservation_cancelled_by_company':
      return reservationCancelled('company', payload);
    case 'trial_reservation_confirmed':
      return trialConfirmed(payload);
    case 'trial_pending_admin':
      return trialPendingAdmin(payload);
    case 'ticket_purchased':
      return ticketPurchased(payload);
    case 'ticket_expiring':
      return ticketExpiring(payload);
    case 'instructor_invite':
      return instructorInvite(payload);
    case 'message_received':
      return messageReceived(payload);
    case 'payout_drafted':
      return payoutDrafted(payload);
    default:
      return defaultTemplate(template, payload);
  }
}

function reservationConfirmed(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/reservations/${p.reservation_id ?? ''}`;
  return {
    subject: '【Kizashi】予約を確定しました',
    text: `予約を確定しました。\n詳細: ${url}`,
    html: `<p>予約を確定しました。</p><p><a href="${url}">予約詳細</a></p>`,
    pushTitle: '予約を確定しました',
    pushBody: '予約詳細を確認できます',
    lineText: `【Kizashi】予約を確定しました。\n${url}`,
    url,
  };
}

function reservationChanged(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/reservations/${p.reservation_id ?? ''}`;
  return {
    subject: '【Kizashi】予約日時を変更しました',
    text: `予約日時を変更しました。\n詳細: ${url}`,
    html: `<p>予約日時を変更しました。</p><p><a href="${url}">予約詳細</a></p>`,
    pushTitle: '予約日時を変更しました',
    pushBody: '新しい日時を確認してください',
    lineText: `【Kizashi】予約日時を変更しました。\n${url}`,
    url,
  };
}

function reservationCancelled(
  by: 'customer' | 'instructor' | 'company',
  p: Record<string, unknown>,
): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/reservations/${p.reservation_id ?? ''}`;
  const ticketReturned = p.ticket_return_rule === 'full_return';
  const reason =
    by === 'instructor'
      ? '講師都合によるキャンセル (Q014: チケット消化なし)'
      : by === 'company'
        ? '弊社都合によるキャンセル (チケット全額返却)'
        : ticketReturned
          ? 'お客様によるキャンセル (無料・チケット返却済)'
          : 'お客様によるキャンセル (チケット消化扱い)';
  return {
    subject: '【Kizashi】予約をキャンセルしました',
    text: `${reason}\n詳細: ${url}`,
    html: `<p>${reason}</p><p><a href="${url}">予約詳細</a></p>`,
    pushTitle: '予約がキャンセルされました',
    pushBody: reason,
    lineText: `【Kizashi】${reason}\n${url}`,
    url,
  };
}

function trialConfirmed(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/reservations/${p.reservation_id ?? ''}`;
  return {
    subject: '【Kizashi】体験予約を確定しました',
    text: `体験予約を確定しました。\n詳細: ${url}`,
    html: `<p>体験予約を確定しました。</p><p><a href="${url}">予約詳細</a></p>`,
    pushTitle: '体験予約を確定しました',
    pushBody: '体験レッスンの詳細を確認できます',
    lineText: `【Kizashi】体験予約を確定しました。\n${url}`,
    url,
  };
}

function trialPendingAdmin(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/admin/trial-reviews`;
  return {
    subject: '【Kizashi 管理者】体験予約の重複確認',
    text: `重複疑いの体験予約申請があります。\n${url}`,
    html: `<p>重複疑いの体験予約申請があります。</p><p><a href="${url}">確認画面</a></p>`,
    pushTitle: '体験予約の重複確認',
    pushBody: '管理者の確認が必要です',
    lineText: `【Kizashi 管理者】重複疑いの体験予約申請があります。\n${url}`,
    url,
  };
}

function ticketPurchased(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/tickets`;
  return {
    subject: '【Kizashi】チケットのご購入ありがとうございます',
    text: `チケットのご購入ありがとうございます。\n${url}`,
    html: `<p>チケットのご購入ありがとうございます。</p><p><a href="${url}">マイチケット</a></p>`,
    pushTitle: 'チケット購入完了',
    pushBody: 'マイページで予約を開始できます',
    lineText: `【Kizashi】チケット購入完了\n${url}`,
    url,
  };
}

function ticketExpiring(p: Record<string, unknown>): NotificationTemplateContent {
  const daysLeft = (p.days_left as number) ?? 0;
  const url = `${APP_URL}/mypage/tickets`;
  return {
    subject: `【Kizashi】チケットの有効期限が ${daysLeft} 日後に迫っています`,
    text: `保有チケットの有効期限が ${daysLeft} 日後に切れます。\n${url}`,
    html: `<p>保有チケットの有効期限が <strong>${daysLeft} 日後</strong>に切れます。</p><p><a href="${url}">マイチケット</a></p>`,
    pushTitle: `チケット期限 ${daysLeft} 日前`,
    pushBody: 'お早めにご予約ください',
    lineText: `【Kizashi】チケットの有効期限が ${daysLeft} 日後に切れます。\n${url}`,
    url,
  };
}

function instructorInvite(p: Record<string, unknown>): NotificationTemplateContent {
  const url = (p.accept_url as string) ?? `${APP_URL}/instructor/accept-invite`;
  const nickname = (p.nickname as string) ?? '';
  return {
    subject: '【Kizashi】講師アカウント発行のご案内',
    text: `${nickname}様\n\n講師アカウントを発行いたしました。\n以下の URL からパスワードを設定してください。\n${url}`,
    html: `<p>${nickname}様</p><p>講師アカウントを発行いたしました。</p><p><a href="${url}">パスワードを設定する</a></p>`,
    pushTitle: '講師アカウント招待',
    pushBody: 'パスワードを設定してください',
    lineText: `【Kizashi】講師アカウント発行のご案内\n${url}`,
    url,
  };
}

function messageReceived(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/mypage/messages/${p.thread_id ?? ''}`;
  return {
    subject: '【Kizashi】新しいメッセージがあります',
    text: `新しいメッセージがあります。\n${url}`,
    html: `<p>新しいメッセージがあります。</p><p><a href="${url}">メッセージを開く</a></p>`,
    pushTitle: '新着メッセージ',
    pushBody: 'メッセージを開いて確認してください',
    lineText: `【Kizashi】新しいメッセージがあります。\n${url}`,
    url,
  };
}

function payoutDrafted(p: Record<string, unknown>): NotificationTemplateContent {
  const url = `${APP_URL}/instructor/payouts`;
  const period = (p.period_month as string) ?? '';
  return {
    subject: `【Kizashi】${period} の精算予定が確定しました`,
    text: `${period} の精算予定が確定しました。\n${url}`,
    html: `<p>${period} の精算予定が確定しました。</p><p><a href="${url}">精算詳細</a></p>`,
    pushTitle: '精算予定の確定',
    pushBody: `${period} の精算をご確認ください`,
    lineText: `【Kizashi】${period} の精算予定が確定しました。\n${url}`,
    url,
  };
}

function defaultTemplate(
  template: string,
  p: Record<string, unknown>,
): NotificationTemplateContent {
  const subject = (p.subject as string) ?? '【Kizashi】お知らせ';
  const text = (p.text as string) ?? `イベント: ${template}`;
  return {
    subject,
    text,
    html: `<p>${text}</p>`,
    pushTitle: subject,
    pushBody: text.slice(0, 100),
    lineText: `${subject}\n${text}`,
  };
}
