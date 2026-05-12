'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  CreateInstructorSchema,
  UpdateInstructorSchema,
  type CreateInstructorInput,
} from '@/lib/validators/instructor';

/**
 * 認可ガード: admin のみ通過
 */
async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    throw new Error('forbidden');
  }
  return me;
}

/**
 * 講師新規登録 Server Action
 *
 * フロー:
 *  1. ensureAdmin
 *  2. parse with zod
 *  3. admin.auth.admin.createUser で auth.users 作成（meta.role='instructor'）
 *     → trigger fn_handle_new_user が profiles を作成 (status=active)
 *  4. profiles.status を 'invited' に戻す
 *  5. instructors レコード作成
 *  6. base_address を addresses に作成、instructors.base_address_id 更新
 *  7. audit_logs 記録
 *  8. 一覧画面へ redirect
 */
export async function createInstructorAction(formData: FormData) {
  const me = await ensureAdmin();

  // FormData → object へ
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('base_address.')) {
      const child = key.replace('base_address.', '');
      const addr = (raw.base_address ??= {}) as Record<string, unknown>;
      addr[child] = value === '' ? null : value;
    } else if (key === 'categories' || key === 'genres') {
      const list = (raw[key] ??= []) as unknown[];
      list.push(value);
    } else {
      raw[key] = value === '' ? undefined : value;
    }
  }

  let parsed: CreateInstructorInput;
  try {
    parsed = CreateInstructorSchema.parse(raw);
  } catch (e) {
    logger.warn('createInstructor parse failed');
    redirect(`/admin/instructors/new?error=validation`);
  }

  const admin = createSupabaseAdminClient();

  // 1. Supabase Auth ユーザー作成
  const { data: created, error: createUserErr } = await admin.auth.admin.createUser({
    email: parsed.contact_email,
    email_confirm: false,
    user_metadata: {
      role: 'instructor',
      name: parsed.nickname,
    },
  });

  if (createUserErr || !created.user) {
    logger.error('admin.createUser (instructor) failed', { code: createUserErr?.message });
    redirect('/admin/instructors/new?error=auth_user_create');
  }

  const profileId = created.user.id;

  // 2. profiles.status を invited に戻す（trigger は active で作る）
  const { error: profUpdErr } = await admin
    .from('profiles')
    .update({ status: 'invited', display_name: parsed.nickname })
    .eq('id', profileId);
  if (profUpdErr) {
    logger.error('profiles update after auth create failed', { code: profUpdErr.code });
  }

  // 3. base_address を作成（instructor の owner_id 確定後に紐付け）
  // 一旦 instructors を作成し、base_address を後から付ける
  const { data: instRow, error: instErr } = await admin
    .from('instructors')
    .insert({
      profile_id: profileId,
      real_name: parsed.real_name,
      real_name_kana: parsed.real_name_kana,
      nickname: parsed.nickname,
      avatar_url: parsed.avatar_url ?? null,
      public_bio: parsed.public_bio ?? null,
      categories: parsed.categories,
      genres: parsed.genres ?? [],
      transportation_mode: parsed.transportation_mode,
      rank: parsed.rank,
      priority: parsed.priority,
      contact_email: parsed.contact_email,
      contact_phone: parsed.contact_phone ?? null,
      status: 'invited',
    })
    .select('id')
    .single();

  if (instErr || !instRow) {
    logger.error('instructors insert failed', { code: instErr?.code });
    // ロールバック: auth user 削除
    await admin.auth.admin.deleteUser(profileId);
    redirect('/admin/instructors/new?error=instructor_create');
  }

  // 4. addresses を作成
  const { data: addrRow, error: addrErr } = await admin
    .from('addresses')
    .insert({
      owner_type: 'instructor',
      owner_id: instRow.id,
      ...parsed.base_address,
    })
    .select('id')
    .single();

  if (addrErr || !addrRow) {
    logger.error('addresses insert failed', { code: addrErr?.code });
    // base_address は失敗しても instructor は作成済み。後で edit で修正可能
  } else {
    // instructors.base_address_id を更新
    const { error: bindErr } = await admin
      .from('instructors')
      .update({ base_address_id: addrRow.id })
      .eq('id', instRow.id);
    if (bindErr) {
      logger.error('instructor base_address_id bind failed', { code: bindErr.code });
    }
  }

  // 5. audit_logs
  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'instructor.created',
    target_table: 'instructors',
    target_id: instRow.id,
    after_data: { rank: parsed.rank, status: 'invited' },
  });

  revalidatePath('/admin/instructors');
  redirect(`/admin/instructors/${instRow.id}?created=1`);
}

/**
 * 講師編集 Server Action
 */
export async function updateInstructorAction(instructorId: string, formData: FormData) {
  const me = await ensureAdmin();

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('base_address.')) {
      const child = key.replace('base_address.', '');
      const addr = (raw.base_address ??= {}) as Record<string, unknown>;
      addr[child] = value === '' ? null : value;
    } else if (key === 'categories' || key === 'genres') {
      const list = (raw[key] ??= []) as unknown[];
      list.push(value);
    } else {
      raw[key] = value === '' ? undefined : value;
    }
  }

  const parsed = UpdateInstructorSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/admin/instructors/${instructorId}/edit?error=validation`);
  }

  const admin = createSupabaseAdminClient();

  // before snapshot for audit
  const { data: before } = await admin
    .from('instructors')
    .select('*')
    .eq('id', instructorId)
    .maybeSingle();

  const updates: Record<string, unknown> = { ...parsed.data };
  delete updates.base_address;

  const { error: updErr } = await admin
    .from('instructors')
    .update(updates)
    .eq('id', instructorId);

  if (updErr) {
    logger.error('instructor update failed', { code: updErr.code });
    redirect(`/admin/instructors/${instructorId}/edit?error=update_failed`);
  }

  // base_address があれば更新（無ければ作成）
  if (parsed.data.base_address) {
    const { data: existing } = await admin
      .from('instructors')
      .select('base_address_id')
      .eq('id', instructorId)
      .single();

    if (existing?.base_address_id) {
      await admin
        .from('addresses')
        .update(parsed.data.base_address)
        .eq('id', existing.base_address_id);
    } else {
      const { data: addr } = await admin
        .from('addresses')
        .insert({
          owner_type: 'instructor',
          owner_id: instructorId,
          ...parsed.data.base_address,
        })
        .select('id')
        .single();
      if (addr) {
        await admin
          .from('instructors')
          .update({ base_address_id: addr.id })
          .eq('id', instructorId);
      }
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'instructor.updated',
    target_table: 'instructors',
    target_id: instructorId,
    before_data: before ? JSON.parse(JSON.stringify(before)) : null,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/admin/instructors');
  revalidatePath(`/admin/instructors/${instructorId}`);
  redirect(`/admin/instructors/${instructorId}?updated=1`);
}

/**
 * 講師の論理削除 (status='deleted')
 *
 * 物理削除はしない (TC024)。予約履歴や精算履歴を保持する。
 */
export async function deleteInstructorAction(instructorId: string) {
  const me = await ensureAdmin();
  const admin = createSupabaseAdminClient();

  const { data: before } = await admin
    .from('instructors')
    .select('status')
    .eq('id', instructorId)
    .maybeSingle();

  const { error } = await admin
    .from('instructors')
    .update({ status: 'deleted' })
    .eq('id', instructorId);

  if (error) {
    logger.error('instructor delete (logical) failed', { code: error.code });
    redirect(`/admin/instructors/${instructorId}?error=delete_failed`);
  }

  // profile も同期
  const { data: prof } = await admin
    .from('instructors')
    .select('profile_id')
    .eq('id', instructorId)
    .single();
  if (prof?.profile_id) {
    await admin.from('profiles').update({ status: 'deleted' }).eq('id', prof.profile_id);
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'instructor.deleted',
    target_table: 'instructors',
    target_id: instructorId,
    before_data: before ?? null,
    after_data: { status: 'deleted' },
  });

  revalidatePath('/admin/instructors');
  redirect('/admin/instructors?deleted=1');
}

/**
 * 招待メール送信 Server Action（API ルート POST のラッパー）
 */
export async function sendInstructorInviteAction(instructorId: string) {
  const me = await ensureAdmin();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  // API ルートを内部から呼ぶ（admin の cookie が同行する）
  const res = await fetch(`${appUrl}/api/admin/instructors/${instructorId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  // 結果に応じてリダイレクト
  if (!res.ok) {
    logger.warn('invite send failed', { code: String(res.status) });
    redirect(`/admin/instructors/${instructorId}?error=invite_failed`);
  }

  // audit_logs は API ルート内で記録済み
  void me; // unused placeholder
  revalidatePath(`/admin/instructors/${instructorId}`);
  redirect(`/admin/instructors/${instructorId}?invited=1`);
}
