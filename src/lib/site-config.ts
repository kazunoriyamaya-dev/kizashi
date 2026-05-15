/**
 * サイト運営者情報 (公開ページ / 法的表記 / メール署名で使用)
 *
 * ⚠️ 本番リリース前に必ず実情報に書き換えること。
 *   - 特定商取引法に基づく表記
 *   - プライバシーポリシー (個人情報取扱事業者)
 *   - メール送信元の by 表記
 *
 * 環境変数で上書き可能 (Vercel 上で SITE_OPERATOR_NAME 等を設定すれば本ファイルは固定で良い)。
 */

function env(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

export const siteConfig = {
  /** サービス名 */
  serviceName: 'Kizashi',
  /** サービス紹介文 (meta description / フッターで使用) */
  serviceTagline:
    '小中学生向けの 1 対 1 パーソナルレッスン予約サービス。お子様一人ひとりに合った先生と学びをつなぎます。',
  /** 運営事業者名 (法人格込み) */
  operatorName: env('SITE_OPERATOR_NAME', '株式会社 KUGEDOU'),
  /** 運営責任者氏名 */
  operatorRepresentative: env('SITE_OPERATOR_REPRESENTATIVE', '山谷 一憲'),
  /** 所在地 (郵便番号 都道府県市区町村 番地) */
  operatorAddress: env('SITE_OPERATOR_ADDRESS', '〒000-0000 東京都〇〇区〇〇 1-2-3'),
  /** 電話番号 */
  operatorPhone: env('SITE_OPERATOR_PHONE', '03-0000-0000'),
  /** 問い合わせ用メール */
  contactEmail: env('CONTACT_EMAIL', 'support@kizashi.example.com'),
  /** 受付時間 */
  contactHours: '平日 10:00–18:00 (土日祝・年末年始を除く)',
  /** サポートサイト URL (FAQ 等。任意) */
  supportUrl: env('SUPPORT_URL', ''),
  /** 個人情報保護責任者 */
  privacyOfficer: env('PRIVACY_OFFICER', '個人情報保護管理者'),
  /** ベースドメイン (本番 URL) */
  appUrl: env('APP_URL', 'https://kizashi.example.com'),
} as const;
