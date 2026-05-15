# 運用観点 UX レビュー (公開直前)

「公開直後に顧客が正しく予約 → 決済 → サービス受講 → 継続購入できるか」の観点で、ブロッカーを洗い出し対処済み。

## 修正したブロッカー

| # | 問題 | 影響 | 対処 |
|---|---|---|---|
| 1 | トップページが "Phase 0 開発雛形" だった | 新規顧客が来てもサービス内容が分からない → 直帰率 100% | `/` を顧客向けランディングに刷新 (ヒーロー / 特長 / ジャンル / 流れ / 料金 / FAQ / CTA 6 セクション) |
| 2 | 特定商取引法に基づく表記 が存在しない | **Stripe 本番審査で却下** / 通報リスク / 違法状態 | `/legal/tokushoho` を作成。事業者情報は `src/lib/site-config.ts` 経由で env で上書き可 |
| 3 | プライバシーポリシーが無い | 改正個人情報保護法違反、Google/LINE OAuth 審査で指摘される | `/legal/privacy` を作成 (取得情報 / 利用目的 / 委託先 / 安全管理 / お子様 / 開示請求 / Cookie) |
| 4 | 利用規約が無い | キャンセル料・チケット失効など合意がない状態。トラブル時に争えない | `/legal/terms` を作成 (14 条。チケット制 / 体験予約 / 1 時間前キャンセル / 連絡規制 / 退会) |
| 5 | お問い合わせ窓口が無い | トラブル時の連絡手段ゼロ。返金要求やクレームの導線がメールしか無い | `/contact` + `/api/contact` (Resend 経由、IP ハッシュでレートリミット 10 分 5 件、自動返信付き) |
| 6 | 公開ページに共通ヘッダー/フッターなし | サービスメニュー / 法的リンクが辿れない | `<PublicHeader>` / `<PublicFooter>` を新設し、`/`, `/lp/[slug]`, `/blog`, `/blog/[slug]`, `/contact`, `/legal/*` に適用 |
| 7 | mypage 内に法的リンクなし | 顧客が利用規約・特商法表記をいつでも確認できない | 顧客 layout フッターに 4 リンク (お問い合わせ / 利用規約 / プライバシー / 特商法) を追加 |
| 8 | ログイン画面の同意文言にリンク無し | 同意の根拠が曖昧 | `/login` の同意文言を `/legal/terms` / `/legal/privacy` リンク付きに |

## 既に問題ない (今回の確認で OK 判定)

- **Stripe Checkout 戻り画面 (`/mypage/tickets/checkout-complete`)** — pending/paid/failed の 3 状態を適切に表示、Webhook を待ちながら自動リフレッシュ
- **404 / エラーページ** — 顧客向け文言、参照 ID 表示あり
- **顧客 dashboard** — お子様未登録カード + 体験未利用カードが既に出る (Sparkles アイコン付きの黄色強調)
- **メッセージ機能** — 体験予約後の講師連絡が可能
- **モバイル最適化** — 顧客 layout は `max-w-screen-md` + 下部固定ナビでスマホファースト
- **セキュリティヘッダ** — `next.config.mjs` で X-Frame-Options DENY / nosniff / Referrer-Policy 設定済

## 運用フロー (公開後の新規顧客導線)

```
SNS / 広告 / 検索
       │
       ▼
 トップ (/)           ← 新ランディング
   │
   ├─ /legal/tokushoho (特商法)
   ├─ /legal/privacy
   ├─ /legal/terms
   ├─ /contact          ← 問い合わせ (Resend で運営に通知 + 自動返信)
   ├─ /blog             ← SEO 流入受け
   ├─ /lp/[slug]        ← 個別キャンペーン
   │
   ▼ 「無料体験レッスンを予約する」CTA
 /login?redirect_to=/mypage/trial-reservation
   │
   ▼ Google / LINE SSO
 顧客アカウント自動作成
   │
   ▼ 子供情報未登録なら強制カード
 /mypage/profile/edit (お子様登録)
   │
   ▼
 /mypage/trial-reservation (体験予約申込)
   │
   ▼ 自動割当 (admin 承認の場合あり)
 体験レッスン受講
   │
   ▼
 /mypage/tickets (チケット購入)
   │
   ▼ Stripe Checkout (本番カードで決済)
 /mypage/tickets/checkout-complete (Webhook で paid 確定)
   │
   ▼
 講師選択 → 予約 → 受講 → 講師精算 (Stripe Connect)
```

## 本番リリース前に必ず実情報に書き換える項目

`.env.example` の以下を Vercel 本番環境変数で設定 (`src/lib/site-config.ts` 経由で法的ページに反映):

```
SITE_OPERATOR_NAME          # 例: 株式会社 KUGEDOU
SITE_OPERATOR_REPRESENTATIVE # 例: 山谷 一憲
SITE_OPERATOR_ADDRESS        # 例: 〒xxx-xxxx 東京都...
SITE_OPERATOR_PHONE          # 例: 03-xxxx-xxxx
CONTACT_EMAIL               # 例: support@kizashi.example.com (Resend ドメイン認証済)
PRIVACY_OFFICER              # 例: 個人情報保護管理者 ◯◯
```

これらが設定されないと `/legal/tokushoho` `/legal/privacy` 上でプレースホルダ住所が表示されます。

## 残るリスクと将来課題 (現バージョンでは妥協)

| リスク | 暫定対処 | 将来対応 |
|---|---|---|
| 料金表示がトップページにハードコード | 既存 `tickets` テーブルのおすすめ商品を表示する SSR 化 | DB 駆動の料金 PRICING セクション |
| 体験予約フォームでお子様登録が別画面 | 体験予約画面に「お子様情報も同時入力」を統合 | UX 改善 |
| 顧客ヘッダーに「ログアウト」しか無い | 設定アイコン下に「お問い合わせ」配置 | 個別実装 |
| 退会フローが管理者依頼制 | 規約に明記 (お問い合わせから依頼) | セルフ退会機能 (P16+) |
| Cookie バナーなし | プライバシーポリシーで明記 | EU/CCPA 対応する場合は別途 |
| メール認証 (パスワード不要型) | Google / LINE SSO のみ | 必要に応じて magic link |
