/**
 * ブログ記事一覧 + 新規作成
 *
 * ai_prompt / ai_model フィールドを残しているので、ChatGPT/Claude/Gemini 等で記事生成したものを
 * ペーストして登録する運用にも対応する。
 */
import Link from 'next/link';
import { listBlogPosts } from '@/lib/marketing/admin-queries';
import { createBlogPost } from '@/lib/marketing/admin-actions';
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

export default async function BlogPostsPage() {
  const posts = await listBlogPosts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ブログ CMS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          /blog/[slug] で公開されます。Markdown 本体を保存し、公開時に HTML キャッシュを生成します。
        </p>
      </div>

      <form
        action={createBlogPost}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="slug">slug</Label>
          <Input id="slug" name="slug" required pattern="[a-z0-9-]+" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">タイトル</Label>
          <Input id="title" name="title" required maxLength={160} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="excerpt">抜粋 (一覧表示用)</Label>
          <Textarea id="excerpt" name="excerpt" rows={2} maxLength={400} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="body_markdown">本文 (Markdown)</Label>
          <Textarea
            id="body_markdown"
            name="body_markdown"
            rows={14}
            required
            placeholder={'# 見出し\n\n本文...'}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tags">タグ (カンマ区切り)</Label>
          <Input id="tags" name="tags" placeholder="学習法, 中学受験, 体験談" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="author_display_name">著者表示名</Label>
          <Input id="author_display_name" name="author_display_name" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="meta_description">meta description (SEO)</Label>
          <Input id="meta_description" name="meta_description" maxLength={300} />
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
            <option value="scheduled">予約公開</option>
            <option value="published">即時公開</option>
            <option value="archived">アーカイブ</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="publish_at">公開予定日時</Label>
          <Input id="publish_at" name="publish_at" type="datetime-local" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai_provider">AI モデル (任意)</Label>
          <Input id="ai_model" name="ai_model" placeholder="claude-opus-4-7 / gpt-4o / gemini-2.5" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai_prompt">AI プロンプト (任意)</Label>
          <Input id="ai_prompt" name="ai_prompt" />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">記事を作成</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイトル</TableHead>
              <TableHead>状態</TableHead>
              <TableHead className="text-right">PV</TableHead>
              <TableHead>公開日</TableHead>
              <TableHead>URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだ記事がありません
                </TableCell>
              </TableRow>
            )}
            {posts.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.title}</div>
                  <div className="font-mono text-xs text-muted-foreground">/blog/{p.slug}</div>
                  {p.tags && p.tags.length > 0 && (
                    <div className="mt-1 flex gap-1 text-xs text-muted-foreground">
                      {p.tags.map((t) => `#${t}`).join(' ')}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={p.status === 'published' ? 'default' : 'secondary'}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{p.view_count ?? 0}</TableCell>
                <TableCell className="text-xs">
                  {p.published_at?.slice(0, 10) ?? p.publish_at?.slice(0, 10) ?? '-'}
                </TableCell>
                <TableCell>
                  {p.status === 'published' && (
                    <Link
                      className="text-xs text-primary hover:underline"
                      href={`/blog/${p.slug}`}
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
