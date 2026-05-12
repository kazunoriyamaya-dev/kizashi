/**
 * POST /api/push/subscribe
 *
 * Web Push 購読を保存（endpoint UNIQUE で upsert）
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const BodySchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  // endpoint UNIQUE で upsert
  const { data: existing } = await admin
    .from('push_subscriptions')
    .select('id, profile_id')
    .eq('endpoint', parsed.data.endpoint)
    .maybeSingle();

  if (existing) {
    await admin
      .from('push_subscriptions')
      .update({
        profile_id: me.userId,
        p256dh_key: parsed.data.keys.p256dh,
        auth_key: parsed.data.keys.auth,
        user_agent: parsed.data.userAgent ?? null,
        last_used_at: new Date().toISOString(),
        revoked_at: null,
      })
      .eq('id', existing.id);
    return NextResponse.json({ id: existing.id, updated: true });
  }

  const { data, error } = await admin
    .from('push_subscriptions')
    .insert({
      profile_id: me.userId,
      endpoint: parsed.data.endpoint,
      p256dh_key: parsed.data.keys.p256dh,
      auth_key: parsed.data.keys.auth,
      user_agent: parsed.data.userAgent ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  return NextResponse.json({ id: data.id, updated: false }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'no_endpoint' }, { status: 400 });

  const admin = createSupabaseAdminClient();
  await admin
    .from('push_subscriptions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('endpoint', endpoint)
    .eq('profile_id', me.userId);
  return NextResponse.json({ ok: true });
}
