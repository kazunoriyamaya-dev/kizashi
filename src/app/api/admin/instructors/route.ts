/**
 * API005 GET /api/admin/instructors  - 講師一覧
 * API006 POST /api/admin/instructors - 講師登録
 *
 * 内部実装は server actions と同等。外部 API 利用や CSV エクスポートに対応する用途想定。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { CreateInstructorSchema } from '@/lib/validators/instructor';
import { logger } from '@/lib/logger';

async function ensureAdminApi() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return null;
  }
  return me;
}

export async function GET(request: NextRequest) {
  const me = await ensureAdminApi();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = request.nextUrl;
  const status = url.searchParams.get('status');
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('instructors')
    .select(
      'id, nickname, real_name, categories, rank, status, transportation_mode, priority, created_at',
    )
    .order('priority', { ascending: false });

  if (status) query = query.eq('status', status as 'active' | 'invited' | 'suspended' | 'deleted');

  const { data, error } = await query;
  if (error) {
    logger.error('admin instructors GET failed', { code: error.code });
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
  return NextResponse.json({ instructors: data });
}

export async function POST(request: NextRequest) {
  const me = await ensureAdminApi();
  if (!me) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = CreateInstructorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation', details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: created, error: createUserErr } = await admin.auth.admin.createUser({
    email: parsed.data.contact_email,
    email_confirm: false,
    user_metadata: { role: 'instructor', name: parsed.data.nickname },
  });
  if (createUserErr || !created.user) {
    return NextResponse.json({ error: 'auth_user_create' }, { status: 500 });
  }

  await admin
    .from('profiles')
    .update({ status: 'invited', display_name: parsed.data.nickname })
    .eq('id', created.user.id);

  const { data: instRow, error: instErr } = await admin
    .from('instructors')
    .insert({
      profile_id: created.user.id,
      real_name: parsed.data.real_name,
      real_name_kana: parsed.data.real_name_kana,
      nickname: parsed.data.nickname,
      avatar_url: parsed.data.avatar_url ?? null,
      public_bio: parsed.data.public_bio ?? null,
      categories: parsed.data.categories,
      genres: parsed.data.genres ?? [],
      transportation_mode: parsed.data.transportation_mode,
      rank: parsed.data.rank,
      priority: parsed.data.priority,
      contact_email: parsed.data.contact_email,
      contact_phone: parsed.data.contact_phone ?? null,
      status: 'invited',
    })
    .select('id')
    .single();

  if (instErr || !instRow) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: 'instructor_create' }, { status: 500 });
  }

  const { data: addrRow } = await admin
    .from('addresses')
    .insert({
      owner_type: 'instructor',
      owner_id: instRow.id,
      ...parsed.data.base_address,
    })
    .select('id')
    .single();
  if (addrRow) {
    await admin.from('instructors').update({ base_address_id: addrRow.id }).eq('id', instRow.id);
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'instructor.created',
    target_table: 'instructors',
    target_id: instRow.id,
    after_data: { rank: parsed.data.rank },
  });

  return NextResponse.json({ id: instRow.id }, { status: 201 });
}
