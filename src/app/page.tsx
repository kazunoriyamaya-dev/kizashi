/**
 * トップページ (顧客向けランディング)
 *
 * 目的: 新規顧客に Kizashi の価値を伝え、無料体験予約に誘導する。
 * 公開ページのため anon でも閲覧可。データベースアクセスは行わない (静的)。
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { PublicHeader } from '@/components/public/site-header';
import { PublicFooter } from '@/components/public/site-footer';
import { siteConfig } from '@/lib/site-config';
import { GraduationCap, Brush, Activity, ShieldCheck, MapPin, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: `${siteConfig.serviceName} | 小中学生向けパーソナルレッスン`,
  description: siteConfig.serviceTagline,
  openGraph: {
    title: siteConfig.serviceName,
    description: siteConfig.serviceTagline,
    type: 'website',
  },
};

const TRIAL_CTA =
  '/login?redirect_to=/mypage/trial-reservation&utm_source=site&utm_medium=top&utm_campaign=trial_cta';

const FEATURES = [
  {
    Icon: GraduationCap,
    title: '一人ひとりに合った先生',
    body: '学習・スポーツ・アートの 3 ジャンル × 講師ランク制で、お子様の目的とペースに合った先生を選べます。',
  },
  {
    Icon: ShieldCheck,
    title: '保護者が安心できる予約管理',
    body: 'メッセージは保護者と先生・管理者の三者ログを保管。決済は Stripe による暗号化、個人情報は最小限のみ保存します。',
  },
  {
    Icon: Activity,
    title: 'オンラインも対面も',
    body: 'Google Meet のオンライン受講と、ご自宅・近くの会場での対面受講を切り替えられます。距離に応じた交通費も明朗会計。',
  },
];

const CATEGORIES = [
  {
    Icon: GraduationCap,
    label: '学習',
    text: '中学受験対策・英語・プログラミング・苦手単元の克服',
  },
  { Icon: Activity, label: 'スポーツ', text: 'サッカー・バスケ・体操・水泳・運動会対策' },
  { Icon: Brush, label: 'アート', text: 'お絵描き・工作・楽器・歌・コンクール対策' },
];

const STEPS = [
  {
    n: '1',
    title: '無料体験を予約',
    body: 'お子様のジャンル・希望時間帯を選ぶだけ。当社が条件に合う先生を自動で割り当てます。',
  },
  {
    n: '2',
    title: '体験レッスンを受講',
    body: 'Google Meet または対面で 60 分。相性を確かめ、続けたい先生を見つけられます。',
  },
  {
    n: '3',
    title: 'チケットで継続',
    body: '5 回・10 回のチケットをお求めいただき、好きなタイミングで予約。兄弟姉妹で残数を共有できます。',
  },
];

const FAQS = [
  {
    q: '体験レッスンは本当に無料ですか？',
    a: 'はい。お子様 1 人につき 1 回まで無料でご提供しています。対面受講時の交通費のみご負担が発生する場合があります。',
  },
  {
    q: 'チケットの有効期限は？',
    a: 'チケット商品ごとに 60〜90 日の有効期限を設定しています。期間内に余裕をもってご予約ください。',
  },
  {
    q: 'キャンセル料は発生しますか？',
    a: 'レッスン開始 1 時間前までのキャンセルはチケット 1 回分を返却します。それ以降は消化扱いです (講師都合の場合は返却)。',
  },
  {
    q: '兄弟姉妹で同じチケットを使えますか？',
    a: 'はい。チケットは保護者アカウント (家族) 単位でご利用いただけます。',
  },
  {
    q: '対面はどの地域に対応していますか？',
    a: '現在は東京 23 区および隣接地域を中心に対応。距離に応じた交通費を予約時に提示します。詳細は無料体験予約時にご確認ください。',
  },
];

export default function Home() {
  return (
    <>
      <PublicHeader />

      {/* Hero */}
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-primary">
                小中学生向け パーソナルレッスン予約サービス
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                お子様にぴったりの先生を、
                <br />
                {siteConfig.serviceName} で見つけよう。
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                学習・スポーツ・アートの 1 対 1 レッスンを、 オンライン /
                対面どちらでも。まずは無料体験から。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={TRIAL_CTA}
                  className="rounded-md bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
                >
                  無料体験レッスンを予約する
                </Link>
                <Link
                  href="#features"
                  className="rounded-md border border-input bg-background px-6 py-4 text-base font-medium hover:bg-muted"
                >
                  サービスを見る
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                体験はお子様 1 人につき 1 回無料 / 1〜2 分で完了 / 勧誘なし
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <p className="text-sm font-semibold">こんな方におすすめ</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  集団塾では伸び悩んでいる
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  習い事を始めたいが何が合うか分からない
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  送迎が大変。自宅で受けたい
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">✓</span>
                  予定が変動するので柔軟にスケジュールしたい
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">{siteConfig.serviceName} の特長</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-lg border bg-card p-6">
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold">対応ジャンル</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            学習・スポーツ・アートを横断して 1 対 1 で指導します
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {CATEGORIES.map(({ Icon, label, text }) => (
              <div key={label} className="rounded-lg border bg-card p-6 text-center">
                <Icon className="mx-auto h-10 w-10 text-primary" />
                <h3 className="mt-3 text-lg font-semibold">{label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">ご利用の流れ</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-lg border bg-card p-6">
              <div className="text-3xl font-bold text-primary">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold">料金</h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            体験は無料。継続はチケット制 (前払い・有効期限内に使用)
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">体験レッスン</p>
              <p className="mt-2 text-3xl font-bold">無料</p>
              <p className="mt-2 text-xs text-muted-foreground">お子様 1 人につき 1 回まで</p>
            </div>
            <div className="rounded-lg border-2 border-primary bg-card p-6 shadow-md">
              <p className="text-sm font-semibold text-primary">おすすめ</p>
              <p className="mt-1 text-sm text-muted-foreground">通常 10 回券 (60 分)</p>
              <p className="mt-2 text-3xl font-bold">¥33,000</p>
              <p className="mt-2 text-xs text-muted-foreground">
                1 回あたり ¥3,300 / 有効期限 90 日
              </p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <p className="text-sm text-muted-foreground">通常 5 回券 (60 分)</p>
              <p className="mt-2 text-3xl font-bold">¥17,500</p>
              <p className="mt-2 text-xs text-muted-foreground">
                1 回あたり ¥3,500 / 有効期限 60 日
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            講師ランク (Gold / Silver / Bronze) によりレッスンごとの指名料が発生する場合があります
            (0〜1,500 円)。
            <br />
            対面の場合は予約時に交通費を明示します (片道距離 × 60 円目安、km 切上げ)。
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-3xl font-bold">まずは無料体験レッスンから</h2>
        <p className="mt-3 text-muted-foreground">
          1〜2 分でお申込み。お子様 1 人につき 1 回まで無料。勧誘の電話・メールは一切ありません。
        </p>
        <Link
          href={TRIAL_CTA}
          className="mt-8 inline-block rounded-md bg-primary px-10 py-4 text-lg font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
        >
          無料体験レッスンを予約する
        </Link>
      </section>

      {/* FAQ */}
      <section className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold">よくあるご質問</h2>
          <div className="mt-8 space-y-4">
            {FAQS.map((f) => (
              <details key={f.q} className="rounded-lg border bg-card p-5">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              対面は東京 23 区および隣接地域 / オンラインは全国
            </span>
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">予約受付 09:00–23:00 (毎日)</span>
          </div>
        </div>
      </section>

      <PublicFooter />
    </>
  );
}
