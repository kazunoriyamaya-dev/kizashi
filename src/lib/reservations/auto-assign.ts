/**
 * 体験予約の自動講師割当 (Q004)
 *
 * 優先順位 (4段階スコアリング):
 *  1. 対応カテゴリ: 必須フィルタ
 *  2. 空き枠: 指定時間範囲内に空きがある講師のみ候補化
 *  3. 稼働均等: 過去30日の確定予約数が少ない講師を優先
 *  4. 管理者優先度: instructors.priority (大きいほど優先)
 *
 * 同点の場合は priority → ニックネーム順で安定ソート。
 *
 * 戻り値:
 *  - 候補がいない場合: null
 *  - いる場合: { instructorId, slot: { start, end } }
 */
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchAvailableSlots, type AvailableSlot } from '@/lib/reservations/availability';
import type { Category } from '@/types';
import { logger } from '@/lib/logger';

export interface AutoAssignRequest {
  category: Category;
  /** 候補生成範囲の開始 ISO */
  fromIso: string;
  /** 候補生成範囲の終了 ISO */
  toIso: string;
  durationMin: number;
  /** 体験は基本オンライン。対面の場合 onsite */
  deliveryType: 'online' | 'onsite';
  /** 顧客が「この時間帯希望」をいくつか出した場合のフィルタ（ISO 8601 開始時刻の配列）。空なら全候補から最良を選ぶ */
  preferredStartIsoList?: string[];
  /** stepMin (slot 生成ステップ, default 30) */
  stepMin?: number;
}

export interface AutoAssignResult {
  instructorId: string;
  slot: AvailableSlot;
}

interface InstructorCandidate {
  id: string;
  nickname: string;
  priority: number;
  recentReservationCount: number;
}

export async function autoAssignInstructorForTrial(
  req: AutoAssignRequest,
): Promise<AutoAssignResult | null> {
  const admin = createSupabaseAdminClient();

  // 1. 対応カテゴリの active 講師を取得
  const { data: instructorsRaw, error: instErr } = await admin
    .from('instructors')
    .select('id, nickname, priority, rank')
    .eq('status', 'active')
    .contains('categories', [req.category]);

  if (instErr) {
    logger.error('auto-assign: fetch instructors failed', { code: instErr.code });
    return null;
  }

  if (!instructorsRaw || instructorsRaw.length === 0) return null;

  // 2. 過去30日の予約数を集計（稼働均等化用）
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentCounts: Map<string, number> = new Map();
  for (const i of instructorsRaw) {
    const { count } = await admin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', i.id)
      .in('status', ['confirmed', 'changed', 'completed'])
      .gte('start_at', thirtyDaysAgo);
    recentCounts.set(i.id, count ?? 0);
  }

  // 3. ソート: 稼働少 → priority 大 → ニックネーム
  const candidates: InstructorCandidate[] = instructorsRaw
    .map((i) => ({
      id: i.id,
      nickname: i.nickname,
      priority: i.priority ?? 0,
      recentReservationCount: recentCounts.get(i.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.recentReservationCount !== b.recentReservationCount) {
        return a.recentReservationCount - b.recentReservationCount;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.nickname.localeCompare(b.nickname);
    });

  // 4. 各候補講師について空き枠を取得して最初に当たったものを採用
  const preferredSet = new Set(req.preferredStartIsoList ?? []);

  for (const cand of candidates) {
    let slots: AvailableSlot[] = [];
    try {
      slots = await fetchAvailableSlots({
        instructorId: cand.id,
        fromIso: req.fromIso,
        toIso: req.toIso,
        durationMin: req.durationMin,
        deliveryType: req.deliveryType,
        stepMin: req.stepMin ?? 30,
      });
    } catch (e) {
      logger.warn('auto-assign: fetchAvailableSlots failed for instructor', {
        code: (e as Error).message,
      });
      continue;
    }

    if (slots.length === 0) continue;

    // 希望時刻フィルタ
    let selected: AvailableSlot | undefined;
    if (preferredSet.size > 0) {
      selected = slots.find((s) => preferredSet.has(s.start));
    } else {
      selected = slots[0]; // 最も早い空き枠
    }

    if (selected) {
      return { instructorId: cand.id, slot: selected };
    }
  }

  return null;
}
