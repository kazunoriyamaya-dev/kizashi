/**
 * ロール定義と権限ヘルパー
 *
 * 設計書: 04_DB_RLS設計 RLS方針
 * - admin: 全データ閲覧・操作・メッセージ監査
 * - instructor: 自分の予約・プロフィール・参加スレッドのみ
 * - customer: 自分・子供・チケット・予約・履歴のみ
 *
 * Phase 2 で各ロール判定の詳細を実装。
 */

export type Role = 'admin' | 'instructor' | 'customer';

export const ROLES: ReadonlyArray<Role> = ['admin', 'instructor', 'customer'] as const;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * ロールに応じた既定のリダイレクト先
 */
export function defaultPathForRole(role: Role): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'instructor':
      return '/instructor';
    case 'customer':
      return '/mypage';
  }
}
