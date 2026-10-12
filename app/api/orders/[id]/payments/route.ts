import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { recordOrderPayment } from '@/lib/ai-sales-foundation';
import { prisma } from '@/lib/prisma';
import { isSalesDataFoundationReady } from '@/lib/sales-data-readiness';

const paymentSchema = z.object({
  kind: z.enum(['RECEIPT', 'REFUND']),
  amount: z.union([z.number(), z.string().trim().min(1)]),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  occurredAt: z.string().datetime().optional(),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!hasPermission(user, 'orders:write')) {
    return NextResponse.json({ error: 'Not enough rights to record order payments.' }, { status: 403 });
  }
  if (!await isSalesDataFoundationReady()) {
    return NextResponse.json({ error: 'Payment recording is temporarily unavailable until the database is updated.' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment details.' }, { status: 400 });

  const { id } = await params;
  const scope = await getRecordScope(user);
  const order = await prisma.order.findFirst({ where: { id, ...(scope ?? {}) }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Order not found or not available.' }, { status: 404 });

  try {
    const payment = await recordOrderPayment({
      ...parsed.data,
      orderId: id,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
    }, { id: user.id });
    return NextResponse.json({ paymentId: payment.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && [
      'Payment amount must be greater than zero.',
      'Payment amount is invalid.',
      'Payment date is invalid.',
      'Payment currency must match the order currency.',
      'Refund cannot exceed recorded receipts.',
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
