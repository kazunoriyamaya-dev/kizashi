/**
 * LP 一覧 + 新規作成 (簡易: hero + body_html + form)
 */
import Link from 'next/link';
import { listLandingPages, listSequences } from '@/lib/marketing/admin-queries';
import { createLandingPage } from '@/lib/marketing/admin-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export default async function LandingPagesPage() {
  const [pages, sequences] = await Promise.all([listLandingPages(), listSequences()]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">LP (ランディングページ)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          /lp/[slug] で公開されます。LP のゴールは <b>新規顧客の体験予約申込</b>。
          公開ページのヘッダー / フッターには常に「無料体験予約」CTA が表示され、
          /login?redirect_to=/mypage/trial-reservation
          経由でアトリビューション付きで体験予約画面に誘導します。
        </p>
      </div>

      <form
        action={createLandingPage}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="slug">slug</Label>
          <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">title (タブ名)</Label>
          <Input id="title" name="title" required maxLength={160} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="headline">ヘッドライン</Label>
          <Input id="headline" name="headline" required maxLength={200} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="subheadline">サブヘッドライン</Label>
          <Input id="subheadline" name="subheadline" maxLength={400} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cta_label">ヒーロー CTA 文言 (任意)</Label>
          <Input id="cta_label" name="cta_label" placeholder="例: 詳しい資料をダウンロード" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cta_url">ヒーロー CTA リンク先 (任意)</Label>
          <Input id="cta_url" name="cta_url" type="url" placeholder="https://..." />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            ※ 「無料体験レッスンを予約する」CTA はゴール固定のため自動で末尾に追加されます。
            下記で文言だけカスタマイズできます。
          </p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="trial_cta_headline">体験予約 CTA 見出し</Label>
          <Input
            id="trial_cta_headline"
            name="trial_cta_headline"
            placeholder="まずは無料体験レッスンから"
            maxLength={200}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="trial_cta_description">体験予約 CTA 説明文</Label>
          <Textarea
            id="trial_cta_description"
            name="trial_cta_description"
            rows={2}
            placeholder="Kizashi の講師と実際にレッスンを体験して..."
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="trial_cta_bullets">
            体験で得られるメリット (1 行 1 項目 or カンマ区切り)
          </Label>
          <Textarea
            id="trial_cta_bullets"
            name="trial_cta_bullets"
            rows={3}
            placeholder={
              'お子様 1 人につき 1 回まで無料\nお子様に合った先生を見つけられます\n勧誘は一切ありません'
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body_html">本文 (HTML)</Label>
          <Textarea
            id="body_html"
            name="body_html"
            rows={8}
            placeholder="<h2>特長</h2><p>...</p>"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sequence_id">紐付けシーケンス (任意)</Label>
          <select
            id="sequence_id"
            name="sequence_id"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="">なし</option>
            {sequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">状態</Label>
          <select
            id="status"
            name="status"
            defaultValue="draft"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="draft">下書き</option>
            <option value="published">公開</option>
            <option value="archived">アーカイブ</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="publish_at">公開予定</Label>
          <Input id="publish_at" name="publish_at" type="datetime-local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unpublish_at">取下げ予定</Label>
          <Input id="unpublish_at" name="unpublish_at" type="datetime-local" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">LP 作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>slug / title</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">PV</TableHead>
              <TableHead className="text-right">CV</TableHead>
              <TableHead>公開URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだ LP がありません
                </TableCell>
              </TableRow>
            )}
            {pages.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">/lp/{p.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === 'published' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{p.view_count ?? 0}</TableCell>
                <TableCell className="text-right">{p.conversion_count ?? 0}</TableCell>
                <TableCell>
                  {p.status === 'published' && (
                    <Link
                      className="text-xs text-primary hover:underline"
                      href={`/lp/${p.slug}`}
                      target="_blank"
                    >
                      開く →
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
