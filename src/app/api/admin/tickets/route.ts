/**
 * API008 POST /api/admin/tickets - チケット登録
 *  +    GET                       - 一覧 (補助)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { TicketSchema } from '@/lib/validators/ticket';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return null;
  return me;
}

export async function GET() {
  const me = await ensureAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .neq('status', 'deleted')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  return NextResponse.json({ tickets: data });
}

export async function POST(request: NextRequest) {
  const me = await ensureAdmin();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = TicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('tickets')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error || !row) return NextResponse.json({ error: 'create_failed' }, { status: 500 });

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.created',
    target_table: 'tickets',
    target_id: row.id,
    after_data: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
