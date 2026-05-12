/**
 * API022 POST /api/maps/travel-fee
 *
 * 単発の交通費見積もり API（予約画面のプレビュー用）
 * Body: { from: address, to: address, mode: 'train' | 'car' }
 *
 * 認可: customer / admin / instructor
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { calculateTravelFare } from '@/lib/google/maps';

const AddressSchema = z.object({
  postal_code: z.string().max(10).optional().nullable(),
  prefecture: z.string().max(20).optional().nullable(),
  city: z.string().max(40).optional().nullable(),
  address_line: z.string().min(1).max(200),
  building: z.string().max(100).optional().nullable(),
});

const BodySchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  mode: z.enum(['train', 'car']),
});

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await calculateTravelFare({
    fromAddress: parsed.data.from,
    toAddress: parsed.data.to,
    mode: parsed.data.mode,
  });

  return NextResponse.json(result);
}
