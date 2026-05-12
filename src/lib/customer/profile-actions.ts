'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { CustomerProfileSchema, ChildSchema } from '@/lib/validators/customer';
import { logger } from '@/lib/logger';

async function ensureCustomer() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'customer') throw new Error('forbidden');
  return me;
}

/**
 * 保護者プロフィール更新
 */
export async function updateCustomerProfileAction(formData: FormData) {
  const me = await ensureCustomer();

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('primary_address.')) {
      const child = key.replace('primary_address.', '');
      const addr = (raw.primary_address ??= {}) as Record<string, unknown>;
      addr[child] = value === '' ? null : value;
    } else {
      raw[key] = value === '' ? undefined : value;
    }
  }

  // primary_address.address_line が空なら primary_address 自体を削除（任意項目）
  if (
    typeof raw.primary_address === 'object' &&
    raw.primary_address !== null &&
    !(raw.primary_address as Record<string, unknown>).address_line
  ) {
    delete raw.primary_address;
  }

  const parsed = CustomerProfileSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/mypage/profile/edit?error=validation');
  }

  const supabase = createSupabaseServerClient();
  const { data: customer, error: fetchErr } = await supabase
    .from('customers')
    .select('id, primary_address_id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (fetchErr || !customer) {
    redirect('/mypage/profile/edit?error=not_found');
  }

  const admin = createSupabaseAdminClient();

  // customers 更新
  const { error: custErr } = await admin
    .from('customers')
    .update({
      parent_name: parsed.data.parent_name,
      parent_kana: parsed.data.parent_kana ?? null,
    })
    .eq('id', customer.id);

  if (custErr) {
    logger.error('customer update failed', { code: custErr.code });
    redirect('/mypage/profile/edit?error=update_failed');
  }

  // profiles の display_name / phone を同期
  const profileUpdates: Record<string, unknown> = {};
  if (parsed.data.display_name) profileUpdates.display_name = parsed.data.display_name;
  if (parsed.data.phone !== undefined) profileUpdates.phone = parsed.data.phone ?? null;
  if (Object.keys(profileUpdates).length > 0) {
    await admin.from('profiles').update(profileUpdates).eq('id', me.userId);
  }

  // primary_address upsert (任意項目)
  if (parsed.data.primary_address) {
    if (customer.primary_address_id) {
      await admin
        .from('addresses')
        .update(parsed.data.primary_address)
        .eq('id', customer.primary_address_id);
    } else {
      const { data: addr } = await admin
        .from('addresses')
        .insert({
          owner_type: 'customer',
          owner_id: customer.id,
          ...parsed.data.primary_address,
        })
        .select('id')
        .single();
      if (addr) {
        await admin
          .from('customers')
          .update({ primary_address_id: addr.id })
          .eq('id', customer.id);
      }
    }
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'customer',
    action: 'customer.profile_updated',
    target_table: 'customers',
    target_id: customer.id,
  });

  revalidatePath('/mypage/profile');
  redirect('/mypage/profile?updated=1');
}

// =====================================================
// 子供 (children) CRUD
// Q003: 体験予約の重複判定キー（名前 + フリガナ + 生年月日）
// 同一保護者内で完全一致は children_uniq_in_customer 制約で禁止
// =====================================================

export async function addChildAction(formData: FormData) {
  const me = await ensureCustomer();

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v === '' ? undefined : v;

  const parsed = ChildSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/mypage/profile/edit?error=child_validation');
  }

  const supabase = createSupabaseServerClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('profile_id', me.userId)
    .maybeSingle();

  if (!customer) redirect('/mypage/profile/edit?error=not_found');

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('children').insert({
    customer_id: customer.id,
    name: parsed.data.name,
    kana: parsed.data.kana,
    birth_date: parsed.data.birth_date,
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    if (error.code === '23505') {
      // children_uniq_in_customer 違反
      redirect('/mypage/profile/edit?error=child_duplicate');
    }
    logger.error('add child failed', { code: error.code });
    redirect('/mypage/profile/edit?error=child_create_failed');
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'customer',
    action: 'child.created',
    target_table: 'children',
  });

  revalidatePath('/mypage/profile');
  redirect('/mypage/profile?child_added=1');
}

export async function updateChildAction(childId: string, formData: FormData) {
  const me = await ensureCustomer();

  const raw: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) raw[k] = v === '' ? undefined : v;

  const parsed = ChildSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(`/mypage/profile/edit?error=child_validation`);
  }

  const supabase = createSupabaseServerClient();
  // RLS で親権限のみ通る
  const { error: updErr } = await supabase
    .from('children')
    .update({
      name: parsed.data.name,
      kana: parsed.data.kana,
      birth_date: parsed.data.birth_date,
      notes: parsed.data.notes ?? null,
    })
    .eq('id', childId);

  if (updErr) {
    if (updErr.code === '23505') {
      redirect('/mypage/profile/edit?error=child_duplicate');
    }
    logger.error('update child failed', { code: updErr.code });
    redirect('/mypage/profile/edit?error=child_update_failed');
  }

  void me;
  revalidatePath('/mypage/profile');
  redirect('/mypage/profile?child_updated=1');
}

/**
 * 子供削除（物理削除可能、ただし予約紐付けがあると FK 制約で失敗する）
 * - children.customer_id ON DELETE CASCADE (顧客削除時のみ)
 * - reservations.child_id ON DELETE RESTRICT (予約あれば削除不可)
 */
export async function deleteChildAction(childId: string) {
  const me = await ensureCustomer();
  const supabase = createSupabaseServerClient();

  const { error } = await supabase.from('children').delete().eq('id', childId);

  if (error) {
    if (error.code === '23503') {
      // FK 制約: 予約に紐付いている
      redirect('/mypage/profile/edit?error=child_has_reservations');
    }
    logger.error('delete child failed', { code: error.code });
    redirect('/mypage/profile/edit?error=child_delete_failed');
  }

  void me;
  revalidatePath('/mypage/profile');
  redirect('/mypage/profile?child_deleted=1');
}
