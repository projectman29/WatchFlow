import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/access';
import { getCurrentUserFromCookies } from '@/lib/auth';
import { getRecordScope } from '@/lib/db-data';
import { recordOrderDirectCost } from '@/lib/ai-sales-foundation';
import { prisma } from '@/lib/prisma';
import { isSalesDataFoundationReady } from '@/lib/sales-data-readiness';

const costSchema = z.object({
  category: z.enum(['MATERIALS', 'LABOR', 'PACKAGING']),
  amount: z.union([z.number(), z.string().trim().min(1)]),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  incurredAt: z.string().datetime().optional(),
  description: z.string().trim().min(1).max(1000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUserFromCookies();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!hasPermission(user, 'orders:write')) {
    return NextResponse.json({ error: 'Not enough rights to record order costs.' }, { status: 403 });
  }
  if (!await isSalesDataFoundationReady()) {
    return NextResponse.json({ error: 'Cost recording is temporarily unavailable until the database is updated.' }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const parsed = costSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid direct cost details.' }, { status: 400 });

  const { id } = await params;
  const scope = await getRecordScope(user);
  const order = await prisma.order.findFirst({ where: { id, ...(scope ?? {}) }, select: { id: true } });
  if (!order) return NextResponse.json({ error: 'Order not found or not available.' }, { status: 404 });

  try {
    const cost = await recordOrderDirectCost({
      ...parsed.data,
      orderId: id,
      incurredAt: parsed.data.incurredAt ? new Date(parsed.data.incurredAt) : undefined,
    }, { id: user.id });
    return NextResponse.json({ costId: cost.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && [
      'Cost amount must be greater than zero.',
      'Cost amount is invalid.',
      'Cost description is required.',
      'Cost date is invalid.',
      'Cost currency must match the order currency.',
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
