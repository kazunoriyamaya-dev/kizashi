/**
 * API009 PATCH /api/admin/tickets/:id - チケット編集
 *      DELETE                       - 論理削除
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { TicketSchema } from '@/lib/validators/ticket';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return null;
  return me;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const me = await ensureAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = TicketSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: before } = await admin.from('tickets').select('*').eq('id', params.id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error } = await admin.from('tickets').update(parsed.data).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.updated',
    target_table: 'tickets',
    target_id: params.id,
    before_data: JSON.parse(JSON.stringify(before)),
    after_data: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ id: params.id });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const me = await ensureAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('tickets').update({ status: 'deleted' }).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.deleted',
    target_table: 'tickets',
    target_id: params.id,
    after_data: { status: 'deleted' },
  });

  return NextResponse.json({ ok: true });
}
