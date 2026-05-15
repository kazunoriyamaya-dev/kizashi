/**
 * アセット一覧 (画像・バナー・動画・ドキュメント)
 *
 * 実ファイルは Supabase Storage の marketing-assets バケットに保存し、
 * その storage_path / public_url を登録するフォーム。
 *
 * AI 自動生成は ai_prompt / ai_provider を記録するメタデータのみ管理する。
 * 実際の生成は外部ツール (DALL·E / Imagen / Canva / Runway 等) からアップロードする運用。
 */
import { listAssets } from '@/lib/marketing/admin-queries';
import { createAsset } from '@/lib/marketing/admin-actions';
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

export default async function AssetsPage() {
  const assets = await listAssets();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">アセット ライブラリ</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          SNS / LP / ブログで使うメディアアセットを登録します。
          画像生成 AI を使った場合は ai_prompt / ai_provider を記録してください。
        </p>
      </div>

      <form
        action={createAsset}
        className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
      >
        <div className="space-y-1">
          <Label htmlFor="title">タイトル</Label>
          <Input id="title" name="title" required maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kind">種別</Label>
          <select
            id="kind"
            name="kind"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            defaultValue="image"
          >
            <option value="image">画像</option>
            <option value="banner">バナー</option>
            <option value="video">動画</option>
            <option value="document">資料</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="storage_path">Storage パス</Label>
          <Input
            id="storage_path"
            name="storage_path"
            required
            placeholder="marketing-assets/campaign-x/hero.png"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="public_url">公開 URL</Label>
          <Input
            id="public_url"
            name="public_url"
            type="url"
            placeholder="https://...supabase.co/storage/v1/object/public/..."
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="tags">タグ (カンマ区切り)</Label>
          <Input id="tags" name="tags" placeholder="hero, summer, instagram" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai_provider">AI 生成元</Label>
          <Input id="ai_provider" name="ai_provider" placeholder="dall-e / midjourney / canva / 自社" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ai_prompt">AI プロンプト</Label>
          <Input id="ai_prompt" name="ai_prompt" placeholder="子供向けのレッスン風景 イラスト" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">説明</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">登録</Button>
        </div>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>タイトル</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>タグ</TableHead>
              <TableHead>AI</TableHead>
              <TableHead>登録日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  まだアセットがありません
                </TableCell>
              </TableRow>
            )}
            {assets.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.title}</div>
                  {a.public_url ? (
                    <a
                      href={a.public_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      プレビュー
                    </a>
                  ) : (
                    <div className="text-xs text-muted-foreground">{a.storage_path}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{a.kind}</Badge>
                </TableCell>
                <TableCell className="text-xs">{(a.tags ?? []).join(', ')}</TableCell>
                <TableCell className="text-xs">{a.ai_provider ?? '-'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.created_at?.slice(0, 10)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
