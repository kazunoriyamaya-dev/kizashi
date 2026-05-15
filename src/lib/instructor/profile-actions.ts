'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  InstructorSelfUpdateSchema,
  InvoiceSettingsSchema,
} from '@/lib/validators/instructor-self';
import { logger } from '@/lib/logger';

async function ensureInstructor() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'instructor') throw new Error('forbidden');
  return me;
}

/**
 * 講師自身のプロフィール更新（公開情報＋自宅住所＋移動手段）
 */
export async function updateInstructorSelfAction(formData: FormData) {
  const me = await ensureInstructor();

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

  const parsed = InstructorSelfUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/instructor/profile/edit?error=validation');
  }

  // 講師自身の instructors レコードを取得（RLS で本人のみ）
  const supabase = createSupabaseServerClient();
  const { data: instructor, error: fetchErr } = await supabase
    .from('instructors')
    .select('id, base_address_id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (fetchErr || !instructor) {
    logger.error('instructor self fetch failed', { code: fetchErr?.code });
    redirect('/instructor/profile/edit?error=not_found');
  }

  const admin = createSupabaseAdminClient();

  // 1. instructors 更新
  const { base_address: addressInput, ...rest } = parsed.data;
  const { error: updErr } = await admin
    .from('instructors')
    .update({
      nickname: rest.nickname,
      avatar_url: rest.avatar_url ?? null,
      public_bio: rest.public_bio ?? null,
      contact_phone: rest.contact_phone ?? null,
      categories: rest.categories,
      genres: rest.genres ?? [],
      transportation_mode: rest.transportation_mode,
    })
    .eq('id', instructor.id);

  if (updErr) {
    logger.error('instructor self update failed', { code: updErr.code });
    redirect('/instructor/profile/edit?error=update_failed');
  }

  // 2. base_address upsert
  if (instructor.base_address_id) {
    await admin.from('addresses').update(addressInput).eq('id', instructor.base_address_id);
  } else {
    const { data: addr } = await admin
      .from('addresses')
      .insert({
        owner_type: 'instructor',
        owner_id: instructor.id,
        ...addressInput,
      })
      .select('id')
      .single();
    if (addr) {
      await admin.from('instructors').update({ base_address_id: addr.id }).eq('id', instructor.id);
    }
  }

  // 3. profiles.display_name も nickname に同期
  await admin.from('profiles').update({ display_name: rest.nickname }).eq('id', me.userId);

  // 4. audit_logs
  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'instructor',
    action: 'instructor.profile_updated',
    target_table: 'instructors',
    target_id: instructor.id,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/instructor/profile');
  redirect('/instructor/profile?updated=1');
}

/**
 * インボイス登録番号の保存（講師自身）
 */
export async function upsertInvoiceSettingsAction(formData: FormData) {
  const me = await ensureInstructor();
  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v === '' ? null : v;

  const parsed = InvoiceSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/instructor/profile/edit?error=invoice_validation');
  }

  const supabase = createSupabaseServerClient();
  const { data: instructor } = await supabase
    .from('instructors')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!instructor) redirect('/instructor/profile/edit?error=not_found');

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from('invoice_settings')
    .select('id')
    .eq('instructor_id', instructor.id)
    .maybeSingle();

  if (existing) {
    await admin
      .from('invoice_settings')
      .update({
        invoice_registration_no: parsed.data.invoice_registration_no ?? null,
        registered_at: parsed.data.registered_at ?? null,
        notes: parsed.data.notes ?? null,
      })
      .eq('id', existing.id);
  } else {
    await admin.from('invoice_settings').insert({
      instructor_id: instructor.id,
      invoice_registration_no: parsed.data.invoice_registration_no ?? null,
      registered_at: parsed.data.registered_at ?? null,
      notes: parsed.data.notes ?? null,
    });
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'instructor',
    action: 'instructor.invoice_updated',
    target_table: 'invoice_settings',
    target_id: instructor.id,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/instructor/profile');
  redirect('/instructor/profile?invoice_updated=1');
}

/**
 * Google Calendar 連携解除（API ルートを内部呼び出し）
 */
export async function disconnectCalendarAction() {
  await ensureInstructor();
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  await fetch(`${appUrl}/api/instructor/google-calendar/disconnect`, { method: 'POST' });
  revalidatePath('/instructor/calendar');
  redirect('/instructor/calendar?disconnected=1');
}
