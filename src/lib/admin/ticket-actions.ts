'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { TicketSchema } from '@/lib/validators/ticket';

async function ensureAdmin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('forbidden');
  return me;
}

function parseTicketFormData(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === 'category' && value === '__common__') {
      raw.category = null;
    } else {
      raw[key] = value === '' ? undefined : value;
    }
  }
  return TicketSchema.safeParse(raw);
}

export async function createTicketAction(formData: FormData) {
  const me = await ensureAdmin();
  const parsed = parseTicketFormData(formData);
  if (!parsed.success) {
    redirect('/admin/tickets/new?error=validation');
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from('tickets')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error || !row) {
    logger.error('ticket create failed', { code: error?.code });
    redirect('/admin/tickets/new?error=create_failed');
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.created',
    target_table: 'tickets',
    target_id: row.id,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/admin/tickets');
  redirect(`/admin/tickets/${row.id}?created=1`);
}

export async function updateTicketAction(ticketId: string, formData: FormData) {
  const me = await ensureAdmin();
  const parsed = parseTicketFormData(formData);
  if (!parsed.success) {
    redirect(`/admin/tickets/${ticketId}?error=validation`);
  }

  const admin = createSupabaseAdminClient();
  const { data: before } = await admin.from('tickets').select('*').eq('id', ticketId).maybeSingle();

  const { error } = await admin.from('tickets').update(parsed.data).eq('id', ticketId);

  if (error) {
    logger.error('ticket update failed', { code: error.code });
    redirect(`/admin/tickets/${ticketId}?error=update_failed`);
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.updated',
    target_table: 'tickets',
    target_id: ticketId,
    before_data: before ? JSON.parse(JSON.stringify(before)) : null,
    after_data: parsed.data as Record<string, unknown>,
  });

  revalidatePath('/admin/tickets');
  revalidatePath(`/admin/tickets/${ticketId}`);
  redirect(`/admin/tickets/${ticketId}?updated=1`);
}

/**
 * 論理削除 (status='deleted')
 *
 * 既購入済みの customer_tickets には影響しない（販売停止扱い）。
 */
export async function deleteTicketAction(ticketId: string) {
  const me = await ensureAdmin();
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from('tickets').update({ status: 'deleted' }).eq('id', ticketId);

  if (error) {
    logger.error('ticket delete failed', { code: error.code });
    redirect(`/admin/tickets/${ticketId}?error=delete_failed`);
  }

  await admin.from('audit_logs').insert({
    actor_profile_id: me.userId,
    actor_role: 'admin',
    action: 'ticket.deleted',
    target_table: 'tickets',
    target_id: ticketId,
    after_data: { status: 'deleted' },
  });

  revalidatePath('/admin/tickets');
  redirect('/admin/tickets?deleted=1');
}
