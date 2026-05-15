/**
 * アフィリエイト 管理: プログラム + 短縮リンク
 */
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { listAffiliateLinks } from '@/lib/marketing/admin-queries';
import { createAffiliateLink, createAffiliateProgram } from '@/lib/marketing/admin-actions';
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

export default async function AffiliatePage() {
  const supabase = createSupabaseServerClient();
  const [{ data: programs }, links] = await Promise.all([
    supabase
      .from('marketing_affiliate_programs')
      .select('id, name, network, base_url, is_active')
      .order('created_at', { ascending: false }),
    listAffiliateLinks(),
  ]);

  const headerList = headers();
  const host = headerList.get('host') ?? '';
  const proto = headerList.get('x-forwarded-proto') ?? 'https';
  const base = host ? `${proto}://${host}` : '';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">アフィリエイト</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ブログ記事や LP から外部 ASP / 自社プログラムへ送客するリンクを管理します。 /r/[code] で
          UTM 付きリダイレクトしてクリックを記録します。
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">プログラム</h2>
        <form
          action={createAffiliateProgram}
          className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="name">名称</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="network">ASP ネットワーク</Label>
            <Input
              id="network"
              name="network"
              required
              placeholder="a8 / valuecommerce / rakuten / amazon / 自社"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="program_id">プログラム ID (任意)</Label>
            <Input id="program_id" name="program_id" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="base_url">基本 URL</Label>
            <Input id="base_url" name="base_url" type="url" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="default_commission_jpy">既定報酬 (円)</Label>
            <Input
              id="default_commission_jpy"
              name="default_commission_jpy"
              type="number"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="default_commission_rate">既定報酬率 (%)</Label>
            <Input
              id="default_commission_rate"
              name="default_commission_rate"
              type="number"
              min={0}
              max={100}
              step="0.1"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="notes">メモ</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">プログラム登録</Button>
          </div>
        </form>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>ASP</TableHead>
                <TableHead>基本URL</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(programs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    プログラム未登録
                  </TableCell>
                </TableRow>
              )}
              {(programs ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-xs">{p.network}</TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs">
                    {p.base_url}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? 'default' : 'secondary'}>
                      {p.is_active ? '稼働中' : '停止'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">短縮リンク</h2>
        <form
          action={createAffiliateLink}
          className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="program_id">プログラム (任意)</Label>
            <select
              id="program_id"
              name="program_id"
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">紐付けなし</option>
              {(programs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.network})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="label">ラベル</Label>
            <Input id="label" name="label" placeholder="ブログ記事冒頭バナー" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="target_url">遷移先 URL</Label>
            <Input id="target_url" name="target_url" type="url" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="utm_source">utm_source</Label>
            <Input id="utm_source" name="utm_source" placeholder="kizashi-blog" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="utm_medium">utm_medium</Label>
            <Input id="utm_medium" name="utm_medium" placeholder="affiliate" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="utm_campaign">utm_campaign</Label>
            <Input id="utm_campaign" name="utm_campaign" placeholder="summer-2026" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="utm_content">utm_content</Label>
            <Input id="utm_content" name="utm_content" placeholder="hero-banner" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">リンク発行</Button>
          </div>
        </form>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>code / URL</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead className="text-right">クリック</TableHead>
                <TableHead className="text-right">CV</TableHead>
                <TableHead>遷移先</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    リンク未発行
                  </TableCell>
                </TableRow>
              )}
              {links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{l.code}</div>
                    {base && (
                      <div className="text-xs text-muted-foreground">
                        {base}/r/{l.code}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{l.label ?? '-'}</TableCell>
                  <TableCell className="text-right">{l.click_count ?? 0}</TableCell>
                  <TableCell className="text-right">{l.conversion_count ?? 0}</TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs">
                    {l.target_url}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
