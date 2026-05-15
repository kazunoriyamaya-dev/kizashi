/**
 * プライバシーポリシー
 *
 * 改正個人情報保護法 + 子供 (16歳未満) のサービス利用に関する保護者同意要件。
 * 法務確認のうえ、必要に応じて文言を調整すること。
 */
import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${siteConfig.serviceName}`,
  description: 'Kizashi の個人情報の取扱いに関する方針',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-slate max-w-none">
      <h1>プライバシーポリシー</h1>
      <p>
        {siteConfig.operatorName}（以下「当社」といいます）は、当社が運営する{' '}
        {siteConfig.serviceName}
        （以下「本サービス」といいます）における個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <h2>1. 取得する個人情報</h2>
      <p>当社は本サービスの提供にあたり、以下の情報を取得することがあります。</p>
      <ul>
        <li>保護者 (アカウント主) の氏名・フリガナ・メールアドレス・電話番号・住所</li>
        <li>お子様の氏名・フリガナ・生年月日</li>
        <li>レッスンの希望条件・受講履歴・予約履歴</li>
        <li>
          クレジットカード情報 (Stripe 社のサーバーにのみ保管され、当社サーバーには保存しません)
        </li>
        <li>本サービス利用時の Cookie / アクセスログ / IP アドレス (匿名化ハッシュで保存)</li>
        <li>Google / LINE 連携時のアカウント識別子、認証トークン (AES-256-GCM で暗号化保存)</li>
      </ul>

      <h2>2. 利用目的</h2>
      <ul>
        <li>本サービスの提供・運営および本人確認</li>
        <li>予約・決済・精算処理</li>
        <li>講師とのマッチングおよび連絡</li>
        <li>お問い合わせ・サポートへの対応</li>
        <li>不正利用・トラブルの防止</li>
        <li>サービス改善のための統計分析 (個人を特定しない形)</li>
        <li>ご本人の同意がある場合のお知らせ・メールマガジン配信</li>
      </ul>

      <h2>3. 第三者提供</h2>
      <p>
        当社は、法令に基づく場合 (個人情報保護法第 27 条 第 1 項各号に該当する場合)
        を除き、ご本人の同意なく個人情報を第三者に提供することはありません。
      </p>

      <h2>4. 業務委託先 (利用する処理者)</h2>
      <p>
        本サービスの運営にあたり、以下の事業者に業務の一部を委託しています。各事業者には、本ポリシーと同等以上の保護義務を課しています。
      </p>
      <ul>
        <li>Supabase Inc. (データベース・認証基盤、米国)</li>
        <li>Vercel Inc. (アプリケーション実行基盤、米国)</li>
        <li>Stripe, Inc. / Stripe Japan 株式会社 (クレジットカード決済代行)</li>
        <li>Google LLC (Google Calendar / Google Maps Routes API 連携)</li>
        <li>LINE Corporation (LINE Login / Messaging API)</li>
        <li>Resend Inc. (メール配信)</li>
      </ul>

      <h2>5. 安全管理措置</h2>
      <ul>
        <li>通信は TLS 1.2 以上で暗号化</li>
        <li>OAuth トークン等の機微情報は AES-256-GCM で暗号化保存</li>
        <li>データベースは Row Level Security により、本人 / 関係講師 / 管理者のみアクセス可</li>
        <li>従業者の教育、アクセス権限の最小化、アクセスログ監査</li>
      </ul>

      <h2>6. お子様の個人情報について</h2>
      <p>
        本サービスは小中学生のお子様向けのレッスンを提供します。お子様の個人情報は必ず保護者の方が
        登録・管理してください。お子様自身でのアカウント登録は受け付けておりません。
      </p>

      <h2>7. ご本人による開示・訂正・利用停止</h2>
      <p>
        ご本人 (またはお子様の保護者)
        は、当社が保有する個人情報の開示・訂正・追加・削除・利用停止・第三者提供停止を求めることができます。お問い合わせ窓口までご連絡ください。
      </p>

      <h2>8. Cookie / アクセス解析</h2>
      <p>
        本サービスでは、ログイン状態の維持・サービス改善のために Cookie および類似技術を使用します。
        マーケティング目的の Cookie は、お問い合わせいただくことでオプトアウト可能です。
      </p>

      <h2>9. お問い合わせ窓口</h2>
      <p>個人情報に関するお問い合わせは以下までお願いいたします。</p>
      <ul>
        <li>事業者: {siteConfig.operatorName}</li>
        <li>個人情報保護管理者: {siteConfig.privacyOfficer}</li>
        <li>メール: {siteConfig.contactEmail}</li>
        <li>受付時間: {siteConfig.contactHours}</li>
      </ul>

      <h2>10. 改定</h2>
      <p>
        本ポリシーの内容は、必要に応じて変更することがあります。重要な変更がある場合は、本サービス内で告知いたします。
      </p>

      <p className="text-xs text-muted-foreground">
        最終更新日: {new Date().toISOString().slice(0, 10)}
      </p>
    </article>
  );
}
