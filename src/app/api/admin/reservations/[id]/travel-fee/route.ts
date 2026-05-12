/**
 * PATCH /api/admin/reservations/:id/travel-fee
 *
 * 管理者が予約の交通費を手動上書きする (Q008 電車取得不可時、Q009 例外時)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { setManualTravelFee } from '@/lib/reservations/travel-fee';

const BodySchema = z.object({
  mode: z.enum(['train', 'car']),
  amount: z.coerce.number().int().min(0).max(100000),
  distance_km: z.coerce.number().min(0).max(1000).optional().nullable(),
  reason: z.string().min(1).max(200),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const result = await setManualTravelFee({
    reservationId: params.id,
    mode: parsed.data.mode,
    amount: parsed.data.amount,
    distanceKm: parsed.data.distance_km ?? null,
    reason: parsed.data.reason,
    actorProfileId: me.userId,
    actorRole: 'admin',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }
  return NextResponse.json({ travel_fee_id: result.travelFeeId });
}
