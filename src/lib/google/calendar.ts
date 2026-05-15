/**
 * Google Calendar API ラッパー
 *
 * 設計書 F022 / Q006:
 *  - freeBusy.query で空き枠取得
 *  - events.insert で予約イベント + Google Meet URL 自動発行（conferenceData）
 *  - events.update / events.delete で予約変更/キャンセル
 *
 * トークンは calendar_connections に AES-GCM 暗号化保存。
 * 期限切れ時は refreshGoogleAccessToken で再取得して DB 更新。
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { decrypt, encrypt } from '@/lib/encryption';
import { refreshGoogleAccessToken } from '@/lib/google/oauth';
import { logger } from '@/lib/logger';

const FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * 講師 instructor_id から最新の access_token を取得（必要に応じて refresh）
 * 取得後の DB 更新まで一括で処理する
 */
async function getValidAccessToken(instructorId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data: conn, error } = await admin
    .from('calendar_connections')
    .select('id, access_token_encrypted, refresh_token_encrypted, expires_at')
    .eq('instructor_id', instructorId)
    .maybeSingle();

  if (error || !conn) {
    throw new Error('calendar_connection_not_found');
  }

  // 期限まで5分以上ある場合は既存の access_token を使う
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  const expiresAt = new Date(conn.expires_at);
  if (expiresAt > fiveMinFromNow) {
    return decrypt(conn.access_token_encrypted);
  }

  // 期限切れ → refresh
  const refreshToken = decrypt(conn.refresh_token_encrypted);
  let refreshed: { access_token: string; expires_in: number; refresh_token?: string };
  try {
    refreshed = await refreshGoogleAccessToken(refreshToken);
  } catch (e) {
    logger.error('refresh google access token failed', { code: (e as Error).message });
    // 連携失敗カウンタを増やす
    await admin
      .from('calendar_connections')
      .update({ sync_failures: (conn as { sync_failures?: number }).sync_failures ?? 0 + 1 })
      .eq('id', conn.id);
    throw new Error('calendar_refresh_failed');
  }

  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  const update: Record<string, unknown> = {
    access_token_encrypted: encrypt(refreshed.access_token),
    expires_at: newExpiresAt,
    last_synced_at: new Date().toISOString(),
    sync_failures: 0,
  };
  if (refreshed.refresh_token) {
    update.refresh_token_encrypted = encrypt(refreshed.refresh_token);
  }
  await admin.from('calendar_connections').update(update).eq('id', conn.id);

  return refreshed.access_token;
}

// =====================================================
// freeBusy
// =====================================================

export interface FreeBusyRange {
  start: string; // ISO8601
  end: string; // ISO8601
}

export async function getFreeBusyForInstructor(
  instructorId: string,
  fromIso: string,
  toIso: string,
): Promise<FreeBusyRange[]> {
  const accessToken = await getValidAccessToken(instructorId);
  const res = await fetch(FREEBUSY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: fromIso,
      timeMax: toIso,
      items: [{ id: 'primary' }],
      timeZone: 'Asia/Tokyo',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('google freeBusy failed', {
      code: String(res.status),
      detail: text.slice(0, 200),
    });
    throw new Error(`google_freebusy_failed_${res.status}`);
  }

  const data = (await res.json()) as {
    calendars?: Record<string, { busy?: FreeBusyRange[] }>;
  };
  const busy = data.calendars?.primary?.busy ?? [];
  return busy;
}

// =====================================================
// events.insert
// =====================================================

export interface CreateCalendarEventInput {
  instructorId: string;
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  attendeeEmails?: string[];
  generateMeetLink?: boolean;
  /** 予約 ID をイベント ID にマッピングするための拡張プロパティ */
  reservationId?: string;
}

export interface CreateCalendarEventResult {
  eventId: string;
  htmlLink?: string;
  meetUrl?: string;
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
): Promise<CreateCalendarEventResult> {
  const accessToken = await getValidAccessToken(input.instructorId);

  const conferenceRequestId = input.reservationId
    ? `kizashi-${input.reservationId}`
    : `kizashi-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? '',
    start: { dateTime: input.startISO, timeZone: 'Asia/Tokyo' },
    end: { dateTime: input.endISO, timeZone: 'Asia/Tokyo' },
    attendees: input.attendeeEmails?.map((email) => ({ email })),
    extendedProperties: input.reservationId
      ? { private: { kizashi_reservation_id: input.reservationId } }
      : undefined,
  };

  if (input.generateMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: conferenceRequestId,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const url = new URL(EVENTS_URL);
  if (input.generateMeetLink) {
    url.searchParams.set('conferenceDataVersion', '1');
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('google events.insert failed', {
      code: String(res.status),
      detail: text.slice(0, 200),
    });
    throw new Error(`google_event_insert_failed_${res.status}`);
  }

  const data = (await res.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  };

  const meetUrl =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri;

  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    meetUrl,
  };
}

// =====================================================
// events.update / events.delete
// =====================================================

export async function updateCalendarEvent(
  instructorId: string,
  eventId: string,
  patch: Partial<{ summary: string; description: string; startISO: string; endISO: string }>,
): Promise<void> {
  const accessToken = await getValidAccessToken(instructorId);
  const url = `${EVENTS_URL}/${encodeURIComponent(eventId)}`;
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.startISO) body.start = { dateTime: patch.startISO, timeZone: 'Asia/Tokyo' };
  if (patch.endISO) body.end = { dateTime: patch.endISO, timeZone: 'Asia/Tokyo' };

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    logger.error('google events.update failed', { code: String(res.status) });
    throw new Error(`google_event_update_failed_${res.status}`);
  }
}

export async function deleteCalendarEvent(instructorId: string, eventId: string): Promise<void> {
  const accessToken = await getValidAccessToken(instructorId);
  const url = `${EVENTS_URL}/${encodeURIComponent(eventId)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 410 (gone) は既に削除済みのため成功扱い
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    logger.error('google events.delete failed', { code: String(res.status) });
    throw new Error(`google_event_delete_failed_${res.status}`);
  }
}
